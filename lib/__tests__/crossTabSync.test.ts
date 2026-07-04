import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { subscribeCrossTabSync, useStore } from "@/lib/store";
import { makeItem } from "./factory";

// Two tabs of the app each hold independent in-memory state. When another
// tab writes our storage key, the browser fires a "storage" event in every
// OTHER tab (never the writer's own tab) — jsdom lets us dispatch that event
// synthetically to exercise the listener registered by subscribeCrossTabSync.
function dispatchStorage(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }));
}

function otherTabPayload(itemId: string) {
  return JSON.stringify({
    version: 2,
    customers: [],
    items: [makeItem({ id: itemId })],
    members: [],
    settings: { currentUser: "" },
  });
}

describe("subscribeCrossTabSync (cross-tab sync) — another tab's write rehydrates this tab", () => {
  let unsub: () => void;

  beforeEach(() => {
    window.localStorage.clear();
    useStore.setState({ items: [], customers: [], members: [], initialized: true });
    unsub = subscribeCrossTabSync();
  });

  afterEach(() => {
    unsub();
    vi.restoreAllMocks();
    window.localStorage.clear();
    useStore.setState({ items: [], customers: [], members: [], initialized: true });
  });

  it("rehydrates this tab's store when another tab writes our storage key", async () => {
    // localStorage is one shared store per origin, so an actual "other tab" write
    // would already be visible here before the storage event even fires. jsdom
    // doesn't do that automatically for a synthetic dispatch, so we write it
    // ourselves first to mirror what a real cross-tab write looks like.
    const payload = otherTabPayload("x");
    window.localStorage.setItem(STORAGE_KEY, payload);
    dispatchStorage(STORAGE_KEY, payload);

    // rehydrate() is async (reads localStorage via getItem + merge) — flush microtasks
    await Promise.resolve();
    await Promise.resolve();

    expect(useStore.getState().items.map((item) => item.id)).toEqual(["x"]);
  });

  it("ignores a storage event for a different key", async () => {
    useStore.setState({ items: [makeItem({ id: "keep-me" })] });

    dispatchStorage("someOtherApp.unrelatedKey", otherTabPayload("intruder"));
    await Promise.resolve();
    await Promise.resolve();

    expect(useStore.getState().items.map((item) => item.id)).toEqual(["keep-me"]);
  });

  it("ignores a storage event whose newValue is null (key cleared/removed)", async () => {
    useStore.setState({ items: [makeItem({ id: "keep-me-too" })] });

    dispatchStorage(STORAGE_KEY, null);
    await Promise.resolve();
    await Promise.resolve();

    expect(useStore.getState().items.map((item) => item.id)).toEqual(["keep-me-too"]);
  });

  // Echo guard: a tab's own write is reflected back to OTHER tabs by the browser,
  // never to the writer itself — but the guard exists so that if the exact same
  // string is ever observed again (e.g. an identical no-op write from elsewhere,
  // or defensively against any environment quirk), we do not call rehydrate and
  // re-record it as lastWrittenRaw. Without this guard, a rehydrate could trigger
  // this tab's own persist write, which would fire another storage event in turn,
  // risking a rehydrate <-> rewrite loop between tabs. We assert this precisely by
  // spying on useStore.persist.rehydrate and checking it is NOT invoked when the
  // dispatched value exactly matches what was just written.
  it("echo guard: does not call rehydrate when newValue matches this tab's last write", async () => {
    const rehydrateSpy = vi.spyOn(useStore.persist, "rehydrate");

    // a genuine local state change triggers a persist write, recording the exact
    // serialized string as lastWrittenRaw inside lib/store.ts
    useStore.setState({ items: [makeItem({ id: "local-write" })] });
    const writtenRaw = window.localStorage.getItem(STORAGE_KEY);
    expect(writtenRaw).toBeTruthy();

    rehydrateSpy.mockClear();

    dispatchStorage(STORAGE_KEY, writtenRaw);
    await Promise.resolve();
    await Promise.resolve();

    expect(rehydrateSpy).not.toHaveBeenCalled();
    expect(useStore.getState().items.map((item) => item.id)).toEqual(["local-write"]);
  });

  it("does call rehydrate when the value genuinely differs from this tab's last write", async () => {
    const rehydrateSpy = vi.spyOn(useStore.persist, "rehydrate");
    useStore.setState({ items: [] });
    rehydrateSpy.mockClear();

    // see comment above: mirror the "other tab" write directly into localStorage
    // before dispatching, since jsdom won't do that for a synthetic event
    const payload = otherTabPayload("other-tab-item");
    window.localStorage.setItem(STORAGE_KEY, payload);
    dispatchStorage(STORAGE_KEY, payload);
    await Promise.resolve();
    await Promise.resolve();

    expect(rehydrateSpy).toHaveBeenCalledTimes(1);
    expect(useStore.getState().items.map((item) => item.id)).toEqual(["other-tab-item"]);
  });
});
