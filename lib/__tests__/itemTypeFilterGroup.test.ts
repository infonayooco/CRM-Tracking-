import { describe, expect, it } from "vitest";
import { activeFilterChips, filteredItems, groupItemsByItemType } from "@/lib/derived";
import { defaultFilters } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// itemType is the one dimension reps couldn't filter or group by, despite it
// being the most-repeated field ("รายการเดิมๆ"). This covers the new
// filters.itemType predicate, its ActiveFilterBar chip, and the new
// groupItemsByItemType helper that powers the "ตามประเภทงาน" list view.

describe("filteredItems — filters.itemType (exact match)", () => {
  const customer = makeCustomer({ id: "c1" });
  const video = makeItem({ id: "video-1", customerId: "c1", itemType: "วิดีโอ" });
  const article = makeItem({ id: "article-1", customerId: "c1", itemType: "บทความ" });

  const state = (itemType: string) => ({
    customers: [customer],
    items: [video, article],
    settings: { currentUser: "" },
    filters: { ...defaultFilters, itemType },
    calDateField: "publishDate" as const,
    statusDim: "exec" as const,
  });

  it("keeps only items matching the exact itemType", () => {
    expect(filteredItems(state("วิดีโอ")).map((item) => item.id)).toEqual(["video-1"]);
  });

  it("keeps all items when unset (default)", () => {
    expect(filteredItems(state("")).map((item) => item.id).sort()).toEqual(["article-1", "video-1"]);
  });

  it("returns nothing for an itemType no item carries", () => {
    expect(filteredItems(state("ไม่มีจริง"))).toEqual([]);
  });
});

describe("activeFilterChips — itemType chip", () => {
  const baseState = {
    customers: [makeCustomer({ id: "c1" })],
    settings: { currentUser: "" },
  };

  it("includes an itemType chip when the filter is set", () => {
    const chips = activeFilterChips({
      ...baseState,
      filters: { ...defaultFilters, itemType: "วิดีโอ" },
    });
    expect(chips).toContainEqual({ key: "itemType", label: "ประเภทงาน: วิดีโอ" });
  });

  it("omits the chip when unset (default)", () => {
    const chips = activeFilterChips({
      ...baseState,
      filters: { ...defaultFilters },
    });
    expect(chips.find((chip) => chip.key === "itemType")).toBeUndefined();
  });
});

describe("groupItemsByItemType", () => {
  it("groups by trimmed itemType, sorted by count desc then label (Thai)", () => {
    const items = [
      makeItem({ id: "1", itemType: "วิดีโอ" }),
      makeItem({ id: "2", itemType: "วิดีโอ" }),
      makeItem({ id: "3", itemType: "บทความ" }),
      makeItem({ id: "4", itemType: "  วิดีโอ  " }), // trims to same group as "วิดีโอ"
    ];
    const groups = groupItemsByItemType(items);

    expect(groups.map(([label]) => label)).toEqual(["วิดีโอ", "บทความ"]);
    expect(groups[0][1].map((item) => item.id).sort()).toEqual(["1", "2", "4"]);
    expect(groups[1][1].map((item) => item.id)).toEqual(["3"]);
  });

  it("falls back to '(ไม่ระบุรายการ)' for a blank/whitespace-only itemType", () => {
    const items = [makeItem({ id: "1", itemType: "" }), makeItem({ id: "2", itemType: "   " })];
    const groups = groupItemsByItemType(items);

    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("(ไม่ระบุรายการ)");
    expect(groups[0][1].map((item) => item.id).sort()).toEqual(["1", "2"]);
  });

  it("breaks a count tie alphabetically (Thai collation)", () => {
    const items = [makeItem({ id: "1", itemType: "บทความ" }), makeItem({ id: "2", itemType: "วิดีโอ" })];
    const groups = groupItemsByItemType(items);
    expect(groups.map(([label]) => label)).toEqual(["บทความ", "วิดีโอ"]);
  });
});
