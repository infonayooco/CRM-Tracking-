import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ItemsView } from "@/components/ItemsView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// The contextual "+ เพิ่มในใบนี้" button on a QT header must prefill the exact
// customer/QT it belongs to, plus the DOMINANT channel among that QT's rows —
// so adding a 6th line never forces the rep to re-pick from the customer
// dropdown or retype the QT number.
describe("QtGroup contextual add button", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({
      items: [],
      customers: [],
      members: [],
      filters: defaultFilters,
      modalItemId: null,
      isItemModalOpen: false,
      newItemPrefill: null,
    });
  });

  it("prefills customerId, qtNo, and the most frequent channel in that QT", () => {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้า A" });
    useStore.setState({
      customers: [customer],
      items: [
        makeItem({ id: "i1", customerId: "c1", qtNo: "QO-1", channel: "line" }),
        makeItem({ id: "i2", customerId: "c1", qtNo: "QO-1", channel: "line" }),
        makeItem({ id: "i3", customerId: "c1", qtNo: "QO-1", channel: "web" }),
      ],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    fireEvent.click(screen.getByLabelText("เพิ่มชิ้นงานในใบ QO-1"));

    const state = useStore.getState();
    expect(state.newItemPrefill).toEqual({ customerId: "c1", qtNo: "QO-1", channel: "line" });
    expect(state.modalItemId).toBeNull();
    expect(state.isItemModalOpen).toBe(true);
  });

  it("the global add button still opens a truly blank form (no prefill)", () => {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้า A" });
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "i1", customerId: "c1", qtNo: "QO-1", channel: "line" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    fireEvent.click(screen.getByRole("button", { name: "เพิ่มชิ้นงาน" }));

    const state = useStore.getState();
    expect(state.newItemPrefill).toBeNull();
    expect(state.modalItemId).toBeNull();
    expect(state.isItemModalOpen).toBe(true);
  });
});
