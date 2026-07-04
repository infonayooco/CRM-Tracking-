import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeView } from "@/components/HomeView";
import { parseDate, startOfDay } from "@/lib/derived";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

describe("HomeView — follow-up act-in-place (note + snooze)", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], lastDeleted: null });
  });

  function seedFollowUpItem() {
    const customer = makeCustomer({ phone: "081-234-5678" });
    useStore.setState({
      customers: [customer],
      items: [
        makeItem({
          id: "follow-1",
          customerId: customer.id,
          execStatus: "in_progress",
          followUpDate: "2020-01-01", // safely overdue regardless of when the suite runs
          followUpNote: "ลูกค้าขอให้โทรกลับช่วงบ่าย",
        }),
      ],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "home",
    });
  }

  it("renders the follow-up note so the rep reads WHY without opening the modal", () => {
    seedFollowUpItem();
    render(<HomeView />);

    expect(screen.getByText("ลูกค้าขอให้โทรกลับช่วงบ่าย")).toBeTruthy();
  });

  it("clicking '+3 วัน' snoozes followUpDate to a computed future date", () => {
    seedFollowUpItem();
    render(<HomeView />);

    const snoozeButton = screen.getByRole("button", { name: /\+3 วัน/ });
    fireEvent.click(snoozeButton);

    const updated = useStore.getState().items.find((item) => item.id === "follow-1");
    const newDate = parseDate(updated?.followUpDate ?? "");
    const today = startOfDay(new Date());

    expect(newDate).not.toBeNull();
    expect(Number(newDate)).toBeGreaterThan(Number(today));
  });
});
