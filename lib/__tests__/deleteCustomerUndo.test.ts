import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

function seed() {
  useStore.setState({
    customers: [makeCustomer({ id: "c1", name: "A" }), makeCustomer({ id: "c2", name: "B" })],
    items: [
      makeItem({ id: "i1", customerId: "c1" }),
      makeItem({ id: "i2", customerId: "c2" }),
      makeItem({ id: "i3", customerId: "c1" }),
    ],
    lastDeleted: null,
    lastDeletedCustomer: null,
  });
}

describe("deleteCustomer + undoDeleteCustomer", () => {
  afterEach(() => {
    useStore.setState({ items: [], customers: [], lastDeleted: null, lastDeletedCustomer: null });
  });

  it("cascade-deletes the customer's items and snapshots them for undo", () => {
    seed();
    useStore.getState().deleteCustomer("c1");

    const state = useStore.getState();
    expect(state.customers.map((c) => c.id)).toEqual(["c2"]);
    expect(state.items.map((i) => i.id)).toEqual(["i2"]);
    expect(state.lastDeletedCustomer?.customer.id).toBe("c1");
    expect(state.lastDeletedCustomer?.items.map((e) => e.item.id)).toEqual(["i1", "i3"]);
    expect(state.lastDeleted).toBeNull(); // one undo toast at a time
  });

  it("restores the customer and every cascaded item in original positions", () => {
    seed();
    useStore.getState().deleteCustomer("c1");
    useStore.getState().undoDeleteCustomer();

    const state = useStore.getState();
    expect(state.customers.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(state.items.map((i) => i.id)).toEqual(["i1", "i2", "i3"]);
    expect(state.lastDeletedCustomer).toBeNull();
  });

  it("is a no-op for an unknown id", () => {
    seed();
    useStore.getState().deleteCustomer("ghost");

    expect(useStore.getState().customers).toHaveLength(2);
    expect(useStore.getState().items).toHaveLength(3);
    expect(useStore.getState().lastDeletedCustomer).toBeNull();
  });
});
