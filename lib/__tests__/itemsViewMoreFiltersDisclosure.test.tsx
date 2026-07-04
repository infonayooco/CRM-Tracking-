import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ItemsView } from "@/components/ItemsView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// "ตัวกรองเพิ่มเติม" disclosure — the long tail of less-used filters (channel,
// itemType, หมวดสถานะ, เจ้าของงานขาย, จังหวัด, date range + presets) collapses
// behind a toggle so the primary trio (search/customer/status) isn't buried
// under ~10 controls. An already-active hidden filter must never be invisible,
// so the disclosure defaults OPEN whenever one of those filters (or a
// non-default หมวดสถานะ, since that persists across sessions) is set on mount.
describe("ItemsView 'ตัวกรองเพิ่มเติม' disclosure", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({
      items: [],
      customers: [],
      members: [],
      filters: defaultFilters,
      statusDim: "exec",
    });
  });

  it("collapses the hidden filters by default when none of them are active", () => {
    const customer = makeCustomer({ id: "c1" });
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "item-1", customerId: "c1" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters },
      statusDim: "exec",
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    const toggle = screen.getByRole("button", { name: /ตัวกรองเพิ่มเติม/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // hidden filters aren't just visually hidden — they're absent from the DOM
    // until expanded, so they never sit in the tab order while collapsed.
    expect(screen.queryByLabelText("ช่องทาง")).toBeNull();
    expect(screen.queryByLabelText("จังหวัด")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("ช่องทาง")).toBeTruthy();
    expect(screen.getByLabelText("จังหวัด")).toBeTruthy();
  });

  it("defaults open and badges the toggle when a hidden filter is already active on mount", () => {
    const customer = makeCustomer({ id: "c1", province: "เชียงใหม่" });
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "item-1", customerId: "c1" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, province: "เชียงใหม่" },
      statusDim: "exec",
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    const toggle = screen.getByRole("button", { name: /ตัวกรองเพิ่มเติม/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("จังหวัด")).toBeTruthy();
    expect(toggle.textContent).toContain("1");
  });

  it("defaults open when หมวดสถานะ carries a non-default value from a previous session", () => {
    const customer = makeCustomer({ id: "c1" });
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "item-1", customerId: "c1" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters },
      statusDim: "result",
      view: "items",
      viewMode: "list",
    });

    render(<ItemsView />);

    const toggle = screen.getByRole("button", { name: /ตัวกรองเพิ่มเติม/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("หมวดสถานะ")).toBeTruthy();
  });
});
