import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ItemsView } from "@/components/ItemsView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// Regression (BUG 8): selectedIds is only cleared on explicit clear / reset
// filters / board switch — NOT when a filter change hides a previously
// selected item. A batch action must therefore only ever touch selected items
// that are STILL VISIBLE under the current filters, never a hidden/stale one.
describe("ItemsView batch actions — stale selection never mutates a filtered-out item", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], members: [], filters: defaultFilters });
  });

  it("only patches the still-visible selected items after the search filter hides one", () => {
    const customer = makeCustomer({ id: "c1" });
    useStore.setState({
      customers: [customer],
      items: [
        makeItem({ id: "hidden-later", customerId: "c1", itemType: "AAA งาน", execStatus: "not_started" }),
        makeItem({ id: "stays-visible", customerId: "c1", itemType: "BBB งาน", execStatus: "not_started" }),
      ],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    // select both items while both are visible
    fireEvent.click(screen.getByLabelText("เลือก AAA งาน"));
    fireEvent.click(screen.getByLabelText("เลือก BBB งาน"));

    // now filter the search so only "BBB งาน" remains visible — the selection
    // for "AAA งาน" goes stale (it is NOT cleared by a filter change)
    const searchInput = screen.getByPlaceholderText("ลูกค้า QT รายการ เป้าหมาย");
    fireEvent.change(searchInput, { target: { value: "BBB" } });

    expect(screen.queryByLabelText("เลือก AAA งาน")).toBeNull(); // hidden by the filter
    expect(screen.getByLabelText("เลือก BBB งาน")).toBeTruthy();

    // trigger the batch action while a hidden item is still in `selectedIds`
    fireEvent.click(screen.getByRole("button", { name: "ทำเครื่องหมายเผยแพร่แล้ว" }));

    const items = useStore.getState().items;
    expect(items.find((item) => item.id === "stays-visible")?.execStatus).toBe("published");
    // the filtered-out item must be untouched, not silently mutated
    expect(items.find((item) => item.id === "hidden-later")?.execStatus).toBe("not_started");
  });
});

// Row-level one-tap status actions on ItemRow (mirrors HomeView's
// AttentionRow quickActions) — a rep should be able to flip a common status
// without opening the full item modal.
describe("ItemsView row quick actions — one-tap status flip without opening the modal", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], members: [], filters: defaultFilters });
  });

  it("marks a not-started item as published, and the button disappears once applied", () => {
    const customer = makeCustomer({ id: "c1" });
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "item-1", customerId: "c1", itemType: "งานทดสอบ", execStatus: "not_started" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    fireEvent.click(screen.getByRole("button", { name: "เผยแพร่แล้ว: งานทดสอบ" }));

    const items = useStore.getState().items;
    expect(items.find((item) => item.id === "item-1")?.execStatus).toBe("published");
    // the row's whole body is also a button that opens the full modal — the
    // quick action must be a sibling, not nested inside it, so this click
    // must not have opened the modal as a side effect
    expect(useStore.getState().isItemModalOpen).toBe(false);
    expect(useStore.getState().modalItemId).toBeNull();
    // once published, the "เผยแพร่แล้ว" shortcut no longer applies and must not render
    expect(screen.queryByRole("button", { name: "เผยแพร่แล้ว: งานทดสอบ" })).toBeNull();
  });
});
