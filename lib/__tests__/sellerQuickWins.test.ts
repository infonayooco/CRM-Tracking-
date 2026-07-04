import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { filteredItems } from "@/lib/derived";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

describe("filters.overdue (#11) — 'งานค้าง' quick filter", () => {
  const overdueItem = makeItem({
    id: "late",
    customerId: "c1",
    execStatus: "in_progress",
    deadline: "2020-01-01",
  });
  const futureItem = makeItem({
    id: "soon",
    customerId: "c1",
    execStatus: "in_progress",
    deadline: "2999-01-01",
  });

  const state = (overdue: boolean) => ({
    customers: [makeCustomer({ id: "c1" })],
    items: [overdueItem, futureItem],
    settings: { currentUser: "" },
    filters: { ...defaultFilters, overdue },
    calDateField: "publishDate" as const,
    statusDim: "exec" as const,
  });

  it("keeps only overdue items when on", () => {
    expect(filteredItems(state(true)).map((item) => item.id)).toEqual(["late"]);
  });

  it("keeps all items when off (default)", () => {
    expect(filteredItems(state(false)).map((item) => item.id).sort()).toEqual(["late", "soon"]);
  });
});

describe("filters.mine persistence (#10)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useStore.setState({ filters: { ...defaultFilters } });
  });

  it("persists filters.mine into localStorage", () => {
    useStore.setState({ filters: { ...defaultFilters, mine: true } });
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).mine).toBe(true);
  });

  it("restores filters.mine from localStorage on rehydrate", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        customers: [],
        items: [],
        members: [],
        settings: { currentUser: "" },
        mine: true,
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().filters.mine).toBe(true);
  });
});
