import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// Regression: duplicateItem used to suffix the copy's itemType with " (สำเนา)".
// That splintered grouping/analytics (salesByItemType, itemTypePerformance,
// etc.) into duplicate-suffixed variants — the copy must keep a clean itemType
// so the rep can edit the one or two differing fields (detail/date) and the
// data stays groupable.
describe("duplicateItem", () => {
  afterEach(() => {
    useStore.setState({ items: [], customers: [] });
  });

  it("returns a new id, inserts the copy right after the original, and keeps itemType clean (no suffix)", () => {
    const customer = makeCustomer({ id: "c1" });
    useStore.setState({
      customers: [customer],
      items: [
        makeItem({ id: "before", customerId: "c1", itemType: "ก่อนหน้า" }),
        makeItem({ id: "original", customerId: "c1", itemType: "โพสต์ Facebook" }),
        makeItem({ id: "after", customerId: "c1", itemType: "ถัดไป" }),
      ],
    });

    const newId = useStore.getState().duplicateItem("original");

    expect(newId).toBeTruthy();
    expect(newId).not.toBe("original");

    const items = useStore.getState().items;
    expect(items.map((item) => item.id)).toEqual(["before", "original", newId, "after"]);

    const duplicated = items.find((item) => item.id === newId);
    expect(duplicated?.itemType).toBe("โพสต์ Facebook");
  });

  it("is a no-op (returns null) for an unknown id", () => {
    useStore.setState({ customers: [], items: [makeItem({ id: "only" })] });

    const result = useStore.getState().duplicateItem("ghost");

    expect(result).toBeNull();
    expect(useStore.getState().items).toHaveLength(1);
  });
});
