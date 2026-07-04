import { describe, expect, it } from "vitest";
import { itemsFollowUpDue } from "@/lib/derived";
import { normalizeItem } from "@/lib/normalize";
import { makeItem } from "./factory";

const TODAY = new Date("2026-07-03T00:00:00.000Z");

describe("itemsFollowUpDue (#8) — personal follow-up worklist", () => {
  it("includes an item whose followUpDate is in the past", () => {
    const items = [makeItem({ id: "past", execStatus: "in_progress", followUpDate: "2026-06-01" })];
    expect(itemsFollowUpDue(items, TODAY).map((item) => item.id)).toEqual(["past"]);
  });

  it("excludes an item whose followUpDate is in the future", () => {
    const items = [makeItem({ id: "future", execStatus: "in_progress", followUpDate: "2026-08-01" })];
    expect(itemsFollowUpDue(items, TODAY)).toHaveLength(0);
  });

  it("includes an item whose followUpDate is today (due, not just overdue)", () => {
    const items = [makeItem({ id: "today", execStatus: "in_progress", followUpDate: "2026-07-03" })];
    expect(itemsFollowUpDue(items, TODAY).map((item) => item.id)).toEqual(["today"]);
  });

  it("excludes a done item even with a past followUpDate — finished work has no moot follow-up", () => {
    const items = [makeItem({ id: "done", execStatus: "done", followUpDate: "2026-06-01" })];
    expect(itemsFollowUpDue(items, TODAY)).toHaveLength(0);
  });

  it("excludes an item with no followUpDate", () => {
    const items = [makeItem({ id: "none", execStatus: "in_progress", followUpDate: "" })];
    expect(itemsFollowUpDue(items, TODAY)).toHaveLength(0);
  });

  it("sorts oldest/most-overdue followUpDate first", () => {
    const items = [
      makeItem({ id: "recent", execStatus: "in_progress", followUpDate: "2026-07-01" }),
      makeItem({ id: "oldest", execStatus: "in_progress", followUpDate: "2026-05-01" }),
      makeItem({ id: "middle", execStatus: "in_progress", followUpDate: "2026-06-15" }),
    ];
    expect(itemsFollowUpDue(items, TODAY).map((item) => item.id)).toEqual(["oldest", "middle", "recent"]);
  });
});

describe("normalizeItem (#8) — followUpDate/followUpNote default safely", () => {
  it("defaults both fields to '' for legacy items missing them", () => {
    const result = normalizeItem({ itemType: "งาน" });
    expect(result.followUpDate).toBe("");
    expect(result.followUpNote).toBe("");
  });
});
