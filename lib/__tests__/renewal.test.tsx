import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HomeView } from "@/components/HomeView";
import { itemsExpired, renewalOutcomes } from "@/lib/derived";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

const TODAY = new Date("2026-07-03T00:00:00.000Z");

describe("renewal math — a 'lost' outcome must count (regression for un-settable lost)", () => {
  it("renewalOutcomes.rate reflects churn: 1 renewed + 1 lost => 50, not 100/null", () => {
    const items = [
      makeItem({ id: "a", renewalStatus: "renewed" }),
      makeItem({ id: "b", renewalStatus: "lost" }),
    ];
    const out = renewalOutcomes(items, TODAY);
    expect(out.total).toBe(2);
    expect(out.renewed).toBe(1);
    expect(out.lost).toBe(1);
    expect(out.pending).toBe(0);
    expect(out.rate).toBe(50);
  });

  it("itemsExpired keeps only pending leads on the radar — lost drops off", () => {
    const items = [
      makeItem({ id: "pending", renewalStatus: "pending" }),
      makeItem({ id: "lost", renewalStatus: "lost" }),
      makeItem({ id: "renewed", renewalStatus: "renewed" }),
    ];
    const expired = itemsExpired(items, TODAY);
    expect(expired.map((item) => item.id)).toEqual(["pending"]);
  });
});

describe("HomeView — expired section exposes a 'ไม่ต่อ' (lost) quick action", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], lastDeleted: null });
  });

  function seedExpiredItem() {
    const customer = makeCustomer();
    useStore.setState({
      customers: [customer],
      items: [makeItem({ id: "expired-1", renewalStatus: "pending", finishedDate: "2020-01-01" })],
      members: [customer.salesOwner],
      settings: { currentUser: customer.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "home",
    });
  }

  it("clicking 'ไม่ต่อ' marks the campaign lost and removes it from the renewal radar", () => {
    seedExpiredItem();
    render(<HomeView />);

    const lostButton = screen.getByRole("button", { name: /ไม่ต่อ/ });
    fireEvent.click(lostButton);

    const updated = useStore.getState().items.find((item) => item.id === "expired-1");
    expect(updated?.renewalStatus).toBe("lost");
    // once lost, it is no longer a pending renewal lead
    expect(itemsExpired(useStore.getState().items, TODAY)).toHaveLength(0);
  });
});
