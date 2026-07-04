import { afterEach, describe, expect, it, vi } from "vitest";
import { onStorageError, useStore } from "@/lib/store";
import { makeItem } from "./factory";

describe("onStorageError (#7) — localStorage write-failure notifier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState({ items: [], customers: [] });
  });

  it("notifies subscribers when a persist write throws", () => {
    let notified = 0;
    const off = onStorageError(() => {
      notified += 1;
    });

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    // any state change triggers the persist write → setItem throws → emit
    useStore.setState({ items: [makeItem({ id: "x" })] });

    expect(notified).toBeGreaterThan(0);
    off();
  });

  it("stops notifying after unsubscribe", () => {
    let notified = 0;
    const off = onStorageError(() => {
      notified += 1;
    });
    off();

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("fail");
    });
    useStore.setState({ items: [makeItem({ id: "y" })] });

    expect(notified).toBe(0);
  });
});
