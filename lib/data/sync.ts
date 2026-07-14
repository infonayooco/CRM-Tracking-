// Keeps the in-memory zustand store and Supabase in sync WITHOUT modifying any
// store action:
//   * hydrateFromSupabase() loads the DB into the store on start.
//   * startSupabaseSync() subscribes to store changes and write-throughs the
//     diff to Supabase, and subscribes to Supabase realtime to apply remote
//     changes back into the store (replacing the old cross-tab storage sync).
//
// NOTE: exercised end-to-end only against a live Supabase project (auth + data).
// The pure diff logic (lib/data/diff.ts) is unit-tested; this module is the IO
// wiring, integrated behind the auth gate in the auth-UI phase.
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import { setLocalPersistDisabled, useStore } from "@/lib/store";
import type { Customer, Item } from "@/lib/types";
import { diffById, diffNumberRecord, diffStringSet } from "./diff";
import { rowToCustomer, rowToItem } from "./mappers";
import {
  type CrmSnapshot,
  type SupabaseDB,
  deleteCustomers,
  deleteItems,
  deleteOwnerQuotas,
  fetchSnapshot,
  fetchTeamRoster,
  setOwnerQuotas,
  upsertCustomers,
  upsertItems,
  upsertMembers,
} from "./repository";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type ItemRow = Database["public"]["Tables"]["items"]["Row"];

const emptySnapshot = (): CrmSnapshot => ({ customers: [], items: [], members: [], ownerQuotas: {} });

// While true, store changes originate from Supabase (hydrate/realtime), so the
// write-through subscription must not echo them back to the DB.
let applyingRemote = false;
let lastSynced: CrmSnapshot = emptySnapshot();
let inFlight: Promise<void> | null = null;

// Surface sync failures to the UI (same idea as the localStorage error channel).
type SyncErrorListener = (error: unknown) => void;
let syncErrorListeners: SyncErrorListener[] = [];
export function onSyncError(listener: SyncErrorListener) {
  syncErrorListeners = [...syncErrorListeners, listener];
  return () => {
    syncErrorListeners = syncErrorListeners.filter((entry) => entry !== listener);
  };
}
function emitSyncError(error: unknown) {
  for (const listener of syncErrorListeners) listener(error);
}

// A push is retried on every store change, so a persistently-failing collection
// (e.g. RLS denies a delete) would otherwise re-emit the identical failure on
// every keystroke. Track the signature of the last surfaced failure set and
// only emit again when it actually changes (a different collection fails, the
// error message changes, or the batch fully recovers and later fails again).
let lastReportedFailureSignature: string | null = null;

// The UI calls this when the user dismisses the sync-error banner. Dismissing
// must not permanently silence an ONGOING failure: RLS/network errors repeat
// with the exact same message on every retry, and the dedupe above only
// re-emits when the failure signature changes. Clearing it here means the
// next push — even if it hits the very same still-failing collection — is
// treated as newly-reportable and reopens the banner, instead of the user
// being left thinking a "dismissed" failure means "resolved".
export function acknowledgeSyncError() {
  lastReportedFailureSignature = null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function currentSnapshot(): CrmSnapshot {
  const state = useStore.getState();
  return {
    customers: state.customers,
    items: state.items,
    members: state.members,
    ownerQuotas: state.ownerQuotas,
  };
}

export async function hydrateFromSupabase(db: SupabaseDB = createClient()): Promise<void> {
  // The DB is the source of truth now: stop mirroring CRM data into localStorage
  // and wipe any prior snapshot, so authenticated data can't linger after logout
  // or be replayed into a later unauthenticated (standalone) render.
  setLocalPersistDisabled(true);
  useStore.persist.clearStorage();

  const data = await fetchSnapshot(db);
  applyingRemote = true;
  try {
    useStore.setState({
      customers: data.customers,
      items: data.items,
      members: data.members,
      ownerQuotas: data.ownerQuotas,
    });
  } finally {
    applyingRemote = false;
  }
  lastSynced = data;

  // Team roster (registered accounts, for the assignee dropdown) is read-only
  // reference data — it is intentionally NOT part of CrmSnapshot/lastSynced, so
  // it is never diffed or written back to Supabase. A failure here (migration
  // not yet applied, or this account has no role yet) must not break hydration
  // of customers/items/members/quotas above, so it's caught and degrades to an
  // empty roster. Not surfaced via emitSyncError/SyncAlert: that channel's copy
  // is specifically about a failed *write*, which would mislead the user here.
  try {
    const teamRoster = await fetchTeamRoster(db);
    applyingRemote = true;
    try {
      useStore.getState().setTeamRoster(teamRoster);
    } finally {
      applyingRemote = false;
    }
  } catch {
    // degrade gracefully — teamRoster stays at its default []
  }
}

export function startSupabaseSync(db: SupabaseDB = createClient()): () => void {
  const unsubscribe = useStore.subscribe(() => {
    if (applyingRemote) return;
    void pushLocalChanges(db);
  });

  const channel = db
    .channel("crm-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "customers" },
      (payload) => applyRemoteCustomer(payload),
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "items" },
      (payload) => applyRemoteItem(payload),
    )
    .subscribe();

  return () => {
    unsubscribe();
    void db.removeChannel(channel);
  };
}

// Names for the four independently-tracked collections, used to key baseline
// advancement and error signatures below.
const COLLECTIONS = ["customers", "items", "members", "ownerQuotas"] as const;
type Collection = (typeof COLLECTIONS)[number];

// Serialize pushes so an edit mid-flight doesn't race the snapshot bookkeeping.
async function pushLocalChanges(db: SupabaseDB): Promise<void> {
  if (inFlight) await inFlight.catch(() => {});

  // Snapshot taken BEFORE any awaits below. On success, a collection's baseline
  // is advanced to its slice of THIS snapshot (not a fresh one taken after the
  // writes resolve) — otherwise a store change that lands mid-flight would be
  // silently folded into the baseline without ever being pushed.
  const state = currentSnapshot();
  const customers = diffById(lastSynced.customers, state.customers);
  const items = diffById(lastSynced.items, state.items);
  const members = diffStringSet(lastSynced.members, state.members);
  const quotas = diffNumberRecord(lastSynced.ownerQuotas, state.ownerQuotas);

  inFlight = (async () => {
    // Each collection's writes are grouped so one collection's failure can't
    // block or roll back another's — Promise.allSettled (rather than
    // Promise.all) ensures every group is attempted regardless of the others.
    // Within a group, all writes must succeed for that collection to advance
    // (e.g. customers has both an upsert and a delete call; a partial success
    // there is treated as "not yet synced" and the whole group is retried next
    // push — upserts/deletes are idempotent, so re-sending the already-applied
    // half is safe).
    const results = await Promise.allSettled([
      Promise.all([upsertCustomers(db, customers.upserts), deleteCustomers(db, customers.deletes)]),
      Promise.all([upsertItems(db, items.upserts), deleteItems(db, items.deletes)]),
      upsertMembers(db, members.added),
      Promise.all([setOwnerQuotas(db, quotas.set), deleteOwnerQuotas(db, quotas.removed)]),
    ]);
    const [customersResult, itemsResult, membersResult, quotasResult] = results;

    if (customersResult.status === "fulfilled") lastSynced = { ...lastSynced, customers: state.customers };
    if (itemsResult.status === "fulfilled") lastSynced = { ...lastSynced, items: state.items };
    if (membersResult.status === "fulfilled") lastSynced = { ...lastSynced, members: state.members };
    if (quotasResult.status === "fulfilled") lastSynced = { ...lastSynced, ownerQuotas: state.ownerQuotas };

    const failures = COLLECTIONS.map((collection, index) => ({ collection, result: results[index] })).filter(
      (entry): entry is { collection: Collection; result: PromiseRejectedResult } =>
        entry.result.status === "rejected",
    );

    if (failures.length === 0) {
      // Full recovery: forget the last-reported failure so if the same error
      // reappears later it is treated as new and surfaced again.
      lastReportedFailureSignature = null;
      return;
    }

    const signature = failures
      .map((f) => `${f.collection}:${errorMessage(f.result.reason)}`)
      .sort()
      .join("|");
    if (signature === lastReportedFailureSignature) return; // identical to what's already shown — don't spam
    lastReportedFailureSignature = signature;

    const combined = new Error(
      `Sync failed for: ${failures.map((f) => f.collection).join(", ")}`,
    ) as Error & { causes: unknown[] };
    combined.causes = failures.map((f) => f.result.reason);
    emitSyncError(combined);
  })();

  try {
    await inFlight;
  } catch (error) {
    // Should not happen — per-collection failures are caught above via
    // allSettled and reported there. This is only a safety net for a genuinely
    // unexpected error, so pushLocalChanges (called as `void pushLocalChanges`)
    // never produces an unhandled rejection.
    emitSyncError(error);
  } finally {
    inFlight = null;
  }
}

function upsertById<T extends { id: string }>(rows: T[], row: T): T[] {
  const index = rows.findIndex((entry) => entry.id === row.id);
  if (index === -1) return [...rows, row];
  const next = rows.slice();
  next[index] = row;
  return next;
}

// Realtime payloads are loosely typed (default record generic); cast the row
// at this boundary and let the mapper re-validate it.
type RemotePayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

function applyRemoteCustomer(payload: RemotePayload) {
  applyingRemote = true;
  try {
    // Apply the SAME single-row change to the baseline as to the store — never
    // currentSnapshot().customers. The store's customers array can contain a
    // different row's local edit that is still unsynced (pending or failed);
    // folding the whole current array into the baseline here would wrongly
    // mark that unrelated edit as synced and it would never be retried.
    if (payload.eventType === "DELETE") {
      const id = (payload.old as { id?: string }).id;
      if (id) {
        useStore.setState((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
        lastSynced = { ...lastSynced, customers: lastSynced.customers.filter((c) => c.id !== id) };
      }
    } else {
      const customer: Customer = rowToCustomer(payload.new as unknown as CustomerRow);
      useStore.setState((s) => ({ customers: upsertById(s.customers, customer) }));
      lastSynced = { ...lastSynced, customers: upsertById(lastSynced.customers, customer) };
    }
  } finally {
    applyingRemote = false;
  }
}

function applyRemoteItem(payload: RemotePayload) {
  applyingRemote = true;
  try {
    // See applyRemoteCustomer — same single-row-only baseline update, for the
    // same reason.
    if (payload.eventType === "DELETE") {
      const id = (payload.old as { id?: string }).id;
      if (id) {
        useStore.setState((s) => ({ items: s.items.filter((item) => item.id !== id) }));
        lastSynced = { ...lastSynced, items: lastSynced.items.filter((item) => item.id !== id) };
      }
    } else {
      const item: Item = rowToItem(payload.new as unknown as ItemRow);
      useStore.setState((s) => ({ items: upsertById(s.items, item) }));
      lastSynced = { ...lastSynced, items: upsertById(lastSynced.items, item) };
    }
  } finally {
    applyingRemote = false;
  }
}

// Test seam: reset module state between unit tests.
export function __resetSyncStateForTests() {
  applyingRemote = false;
  lastSynced = emptySnapshot();
  inFlight = null;
  syncErrorListeners = [];
  lastReportedFailureSignature = null;
}
