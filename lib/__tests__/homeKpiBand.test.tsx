import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeView } from "@/components/HomeView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

describe("HomeView — exec KPI health band", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], lastDeleted: null });
  });

  it("renders health tiles wired to the scoped data (1 of 2 achieved => 50%)", () => {
    const customer = makeCustomer();
    useStore.setState({
      customers: [customer],
      items: [
        makeItem({ id: "a", customerId: customer.id, resultStatus: "achieved", reportStatus: "sent" }),
        makeItem({ id: "b", customerId: customer.id, resultStatus: "not_collected", reportStatus: "sent" }),
      ],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "home",
    });

    render(<HomeView />);

    // band tiles present
    expect(screen.getByText("รายได้เดือนนี้")).toBeTruthy();
    expect(screen.getByText("บรรลุผล")).toBeTruthy();
    expect(screen.getByText("ส่งรีพอร์ต")).toBeTruthy();
    expect(screen.getByText("รอต่ออายุ")).toBeTruthy();

    // 1 of 2 achieved => 50% (unique in the band; report-sent is 100%)
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("100%")).toBeTruthy();
  });
});
