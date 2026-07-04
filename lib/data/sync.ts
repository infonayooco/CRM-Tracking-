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
import { useStore } from "@/lib/store";
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

// Serialize pushes so an edit mid-flight doesn't race the snapshot bookkeeping.
async function pushLocalChanges(db: SupabaseDB): Promise<void> {
  if (inFlight) await inFlight.catch(() => {});

  const state = currentSnapshot();
  const customers = diffById(lastSynced.customers, state.customers);
  const items = diffById(lastSynced.items, state.items);
  const members = diffStringSet(lastSynced.members, state.members);
  const quotas = diffNumberRecord(lastSynced.ownerQuotas, state.ownerQuotas);
  lastSynced = state;

  inFlight = (async () => {
    await Promise.all([
      upsertCustomers(db, customers.upserts),
      deleteCustomers(db, customers.deletes),
      upsertItems(db, items.upserts),
      deleteItems(db, items.deletes),
      upsertMembers(db, members.added),
      setOwnerQuotas(db, quotas.set),
      deleteOwnerQuotas(db, quotas.removed),
    ]);
  })();

  try {
    await inFlight;
  } catch (error) {
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
    if (payload.eventType === "DELETE") {
      const id = (payload.old as { id?: string }).id;
      if (id) useStore.setState((s) => ({ customers: s.customers.filter((c) => c.id !== id) }));
    } else {
      const customer: Customer = rowToCustomer(payload.new as unknown as CustomerRow);
      useStore.setState((s) => ({ customers: upsertById(s.customers, customer) }));
    }
    lastSynced = currentSnapshot();
  } finally {
    applyingRemote = false;
  }
}

function applyRemoteItem(payload: RemotePayload) {
  applyingRemote = true;
  try {
    if (payload.eventType === "DELETE") {
      const id = (payload.old as { id?: string }).id;
      if (id) useStore.setState((s) => ({ items: s.items.filter((item) => item.id !== id) }));
    } else {
      const item: Item = rowToItem(payload.new as unknown as ItemRow);
      useStore.setState((s) => ({ items: upsertById(s.items, item) }));
    }
    lastSynced = currentSnapshot();
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
}
