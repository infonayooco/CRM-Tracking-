import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseDB } from "@/lib/data/repository";
import {
  __resetSyncStateForTests,
  acknowledgeSyncError,
  hydrateFromSupabase,
  onSyncError,
  startSupabaseSync,
} from "@/lib/data/sync";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

type Call = { op: "select" | "upsert" | "delete" | "rpc"; table: string; payload?: unknown };
type WriteResult = { error: unknown };
type WriteHandler = () => WriteResult | Promise<WriteResult>;
type RealtimeHandler = (payload: unknown) => void;

// Minimal fake of the supabase-js query builder (same shape as
// dataRepository.test.ts's fakeDb) plus a realtime channel stub that CAPTURES
// the .on() callbacks per table (rather than being a no-op), so tests can
// invoke applyRemoteCustomer/applyRemoteItem with a synthetic payload. Per-table
// upsert/delete handlers let a test control success/failure/timing per call.
function fakeDb(handlers: { upsert?: Partial<Record<string, WriteHandler>>; del?: Partial<Record<string, WriteHandler>> } = {}) {
  const calls: Call[] = [];
  const realtime: Partial<Record<string, RealtimeHandler>> = {};
  const db = {
    from(table: string) {
      return {
        select() {
          calls.push({ op: "select", table });
          return Promise.resolve({ data: [], error: null });
        },
        async upsert(rows: unknown) {
          calls.push({ op: "upsert", table, payload: rows });
          const handler = handlers.upsert?.[table];
          return handler ? handler() : { error: null };
        },
        delete() {
          return {
            async in(_col: string, ids: unknown) {
              calls.push({ op: "delete", table, payload: ids });
              const handler = handlers.del?.[table];
              return handler ? handler() : { error: null };
            },
          };
        },
      };
    },
    rpc() {
      calls.push({ op: "rpc", table: "list_team_roster" });
      return Promise.resolve({ data: [], error: null });
    },
    channel() {
      const chain = {
        on: (_event: string, filter: { table: string }, cb: RealtimeHandler) => {
          realtime[filter.table] = cb;
          return chain;
        },
        subscribe: () => chain,
      };
      return chain;
    },
    removeChannel: () => Promise.resolve({ error: null, status: "ok" as const }),
  };
  return { db: db as unknown as SupabaseDB, calls, realtime };
}

function upsertCallsFor(calls: Call[], table: string) {
  return calls.filter((c) => c.op === "upsert" && c.table === table);
}

// Minimal Supabase row shapes (snake_case) for synthetic realtime payloads —
// rowToCustomer/rowToItem + normalize.ts fill in sane defaults for anything
// omitted here.
function customerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "c-remote",
    name: "Remote",
    province: "",
    province_code: null,
    sales_owner: "",
    contact_person: "",
    phone: "",
    email: "",
    line_id: "",
    color: "#2563eb",
    interactions: [],
    created_at: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function itemRow(overrides: Record<string, unknown> = {}) {
  return { id: "i-remote", customer_id: null, ...overrides };
}

describe("pushLocalChanges (per-collection sync baseline)", () => {
  let stop: (() => void) | null = null;

  beforeEach(() => {
    __resetSyncStateForTests();
    useStore.setState({ customers: [], items: [], members: [], ownerQuotas: {}, initialized: true });
  });

  afterEach(() => {
    stop?.();
    stop = null;
    __resetSyncStateForTests();
    useStore.setState({ customers: [], items: [], members: [], ownerQuotas: {}, initialized: true });
    vi.restoreAllMocks();
  });

  it("a failing collection is retried and does not block or re-send an unrelated succeeding collection", async () => {
    const c1 = makeCustomer({ id: "c1" });
    const i1 = makeItem({ id: "i1" });
    const { db, calls } = fakeDb({
      upsert: { customers: () => ({ error: { message: "RLS denied" } }) },
    });
    await hydrateFromSupabase(db);
    const onError = vi.fn();
    onSyncError(onError);
    stop = startSupabaseSync(db);

    useStore.setState({ customers: [c1], items: [i1] });
    await vi.waitFor(() => {
      expect(upsertCallsFor(calls, "customers")).toHaveLength(1);
      expect(upsertCallsFor(calls, "items")).toHaveLength(1);
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // Trigger a second push via an unrelated items change. The items
    // collection must NOT re-send i1 (its baseline advanced), while the
    // customers collection must retry c1 (its baseline never advanced).
    const i2 = makeItem({ id: "i2" });
    useStore.setState({ items: [i1, i2] });
    await vi.waitFor(() => expect(upsertCallsFor(calls, "items")).toHaveLength(2));

    expect(upsertCallsFor(calls, "items").at(-1)?.payload).toEqual([
      expect.objectContaining({ id: "i2" }),
    ]);
    await vi.waitFor(() => expect(upsertCallsFor(calls, "customers")).toHaveLength(2));
    expect(upsertCallsFor(calls, "customers").at(-1)?.payload).toEqual([
      expect.objectContaining({ id: "c1" }),
    ]);
  });

  it("a failed collection stops being retried once it succeeds", async () => {
    const c1 = makeCustomer({ id: "c1" });
    let customersShouldFail = true;
    const { db, calls } = fakeDb({
      upsert: {
        customers: () => (customersShouldFail ? { error: { message: "RLS denied" } } : { error: null }),
      },
    });
    await hydrateFromSupabase(db);
    stop = startSupabaseSync(db);

    useStore.setState({ customers: [c1] });
    await vi.waitFor(() => expect(upsertCallsFor(calls, "customers")).toHaveLength(1));

    // Recover, then trigger another push (member change) — customers has no
    // new local edits, but its stale baseline still owes c1, so it retries.
    customersShouldFail = false;
    useStore.setState({ members: ["A"] });
    await vi.waitFor(() => expect(upsertCallsFor(calls, "customers")).toHaveLength(2));

    // Baseline is now caught up: a further, unrelated push must not re-send c1.
    useStore.setState({ members: ["A", "B"] });
    await vi.waitFor(() => expect(calls.filter((c) => c.op === "upsert" && c.table === "members")).toHaveLength(2));
    expect(upsertCallsFor(calls, "customers")).toHaveLength(2);
  });

  it("does not re-emit an identical failure on every push, but does emit a new distinct failure", async () => {
    const onError = vi.fn();
    let itemsShouldFail = false;
    const { db } = fakeDb({
      upsert: {
        customers: () => ({ error: { message: "same failure" } }),
        items: () => (itemsShouldFail ? { error: { message: "items failure" } } : { error: null }),
      },
    });
    await hydrateFromSupabase(db);
    onSyncError(onError);
    stop = startSupabaseSync(db);

    useStore.setState({ customers: [makeCustomer({ id: "c1" })] });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // Same failure again on the next push (retry) — must not spam the listener.
    useStore.setState({ members: ["A"] });
    await vi.waitFor(() => expect(useStore.getState().members).toEqual(["A"]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(onError).toHaveBeenCalledTimes(1);

    // A genuinely NEW, distinct failure — items starts failing too, changing
    // the failure set even though customers' failure is unchanged. This must
    // still be surfaced: the dedupe is keyed on the failure signature, not on
    // "have we ever shown a banner", so a second, different failure is not
    // swallowed by the first one's suppression.
    itemsShouldFail = true;
    useStore.setState({ items: [makeItem({ id: "i1" })] });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
  });

  it("a store change made while a push is in flight is not lost", async () => {
    const resolvers: Array<(result: WriteResult) => void> = [];
    const { db, calls } = fakeDb({
      upsert: {
        customers: () => new Promise<WriteResult>((resolve) => resolvers.push(resolve)),
      },
    });
    await hydrateFromSupabase(db);
    stop = startSupabaseSync(db);

    const c1 = makeCustomer({ id: "c1" });
    useStore.setState({ customers: [c1] });
    await vi.waitFor(() => expect(resolvers).toHaveLength(1));

    // A second edit lands while push #1 is still in flight.
    const c2 = makeCustomer({ id: "c2" });
    useStore.setState({ customers: [c1, c2] });

    // Let push #1 succeed; its baseline snapshot only had c1.
    resolvers[0]({ error: null });
    await vi.waitFor(() => expect(resolvers).toHaveLength(2));
    // Push #2 (serialized after #1) now diffs against the latest store state
    // and must send c2 — it must not have been folded into #1's baseline.
    resolvers[1]({ error: null });

    await vi.waitFor(() => {
      const payloads = upsertCallsFor(calls, "customers").map((c) => c.payload);
      expect(payloads).toEqual([
        [expect.objectContaining({ id: "c1" })],
        [expect.objectContaining({ id: "c2" })],
      ]);
    });

    // Fully caught up: one more unrelated push must not re-send c1 or c2.
    useStore.setState({ members: ["A"] });
    await vi.waitFor(() => expect(useStore.getState().members).toEqual(["A"]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(upsertCallsFor(calls, "customers")).toHaveLength(2);
  });

  it("a failed local edit is not folded into the baseline by an unrelated realtime event (customers + items)", async () => {
    const c1 = makeCustomer({ id: "c1" });
    const i1 = makeItem({ id: "i1" });
    const { db, calls, realtime } = fakeDb({
      upsert: {
        customers: () => ({ error: { message: "RLS denied" } }),
        items: () => ({ error: { message: "RLS denied" } }),
      },
    });
    await hydrateFromSupabase(db);
    stop = startSupabaseSync(db);
    expect(realtime.customers).toBeTypeOf("function");
    expect(realtime.items).toBeTypeOf("function");

    useStore.setState({ customers: [c1], items: [i1] });
    await vi.waitFor(() => {
      expect(upsertCallsFor(calls, "customers")).toHaveLength(1);
      expect(upsertCallsFor(calls, "items")).toHaveLength(1);
    });

    // An unrelated realtime event arrives for a DIFFERENT customer and item —
    // this must only advance the baseline for that one row, not fold c1/i1's
    // still-failed local edits into "synced".
    realtime.customers?.({ eventType: "INSERT", new: customerRow({ id: "c-remote" }), old: {} });
    realtime.items?.({ eventType: "INSERT", new: itemRow({ id: "i-remote" }), old: {} });
    expect(useStore.getState().customers.map((c) => c.id).sort()).toEqual(["c-remote", "c1"]);
    expect(useStore.getState().items.map((i) => i.id).sort()).toEqual(["i-remote", "i1"]);

    // Trigger another push via an unrelated local mutation.
    useStore.setState({ members: ["A"] });
    await vi.waitFor(() => expect(useStore.getState().members).toEqual(["A"]));

    // c1/i1 must still be retried — the realtime event must not have marked
    // them as synced. c-remote/i-remote must NOT be re-sent (already synced by
    // the realtime event itself).
    await vi.waitFor(() => {
      expect(upsertCallsFor(calls, "customers")).toHaveLength(2);
      expect(upsertCallsFor(calls, "items")).toHaveLength(2);
    });
    expect(upsertCallsFor(calls, "customers").at(-1)?.payload).toEqual([
      expect.objectContaining({ id: "c1" }),
    ]);
    expect(upsertCallsFor(calls, "items").at(-1)?.payload).toEqual([expect.objectContaining({ id: "i1" })]);
  });

  it("dismissing the alert re-arms notification for a still-ongoing failure", async () => {
    const onError = vi.fn();
    const { db } = fakeDb({
      upsert: { customers: () => ({ error: { message: "same failure" } }) },
    });
    await hydrateFromSupabase(db);
    onSyncError(onError);
    stop = startSupabaseSync(db);

    useStore.setState({ customers: [makeCustomer({ id: "c1" })] });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    // User dismisses the banner while the failure is still ongoing (the
    // customers baseline never advanced, so the write is still pending).
    acknowledgeSyncError();

    // The next retry hits the exact same still-failing collection with the
    // identical error message — without the dismiss re-arming notification,
    // the dedupe would suppress this forever and the banner would never
    // return, leaving the user thinking their data is saving fine.
    useStore.setState({ members: ["A"] });
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(2));
  });
});
