import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";

describe("openNewItem", () => {
  afterEach(() => {
    useStore.setState({ modalItemId: null, isItemModalOpen: false, newItemPrefill: null });
  });

  it("opens a NEW item modal carrying the given prefill", () => {
    useStore.getState().openNewItem({ customerId: "c1", qtNo: "Q1", channel: "line" });

    const state = useStore.getState();
    expect(state.newItemPrefill).toEqual({ customerId: "c1", qtNo: "Q1", channel: "line" });
    expect(state.modalItemId).toBeNull();
    expect(state.isItemModalOpen).toBe(true);
  });

  it("opens a truly blank NEW item modal when called with no argument", () => {
    useStore.getState().openNewItem();

    const state = useStore.getState();
    expect(state.newItemPrefill).toBeNull();
    expect(state.modalItemId).toBeNull();
    expect(state.isItemModalOpen).toBe(true);
  });

  it("closeItemModal clears a stale prefill back to null", () => {
    useStore.getState().openNewItem({ customerId: "c1", qtNo: "Q1", channel: "line" });
    expect(useStore.getState().newItemPrefill).not.toBeNull();

    useStore.getState().closeItemModal();

    const state = useStore.getState();
    expect(state.newItemPrefill).toBeNull();
    expect(state.modalItemId).toBeNull();
    expect(state.isItemModalOpen).toBe(false);
  });
});
