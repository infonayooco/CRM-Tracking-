import { describe, expect, it } from "vitest";
import { attentionDueCount } from "@/lib/derived";
import { makeItem } from "./factory";

// makeItem defaults execStatus to "done" — every case below overrides it to a
// non-done status so isOverdue/itemsFollowUpDue actually apply.
const TODAY = new Date("2026-07-03T00:00:00.000Z");

describe("attentionDueCount — nav 'needs attention today' badge count", () => {
  it("counts an item with a past followUpDate (non-done)", () => {
    const items = [makeItem({ id: "follow-up-due", execStatus: "in_progress", followUpDate: "2026-06-01" })];
    expect(attentionDueCount(items, TODAY)).toBe(1);
  });

  it("counts an overdue item (deadline in the past, not done)", () => {
    const items = [makeItem({ id: "overdue", execStatus: "in_progress", deadline: "2026-06-01" })];
    expect(attentionDueCount(items, TODAY)).toBe(1);
  });

  it("counts an item that is BOTH follow-up-due AND overdue as 2 — the two buckets are summed, not de-duped", () => {
    const items = [
      makeItem({
        id: "both",
        execStatus: "in_progress",
        deadline: "2026-06-01",
        followUpDate: "2026-06-15",
      }),
    ];
    expect(attentionDueCount(items, TODAY)).toBe(2);
  });

  it("counts 0 for a future/clean item — no overdue deadline and no due follow-up", () => {
    const items = [
      makeItem({
        id: "clean",
        execStatus: "in_progress",
        deadline: "2026-08-01",
        followUpDate: "2026-08-01",
      }),
    ];
    expect(attentionDueCount(items, TODAY)).toBe(0);
  });

  it("counts 0 for a done item even with past deadline/followUpDate dates", () => {
    const items = [
      makeItem({
        id: "done",
        execStatus: "done",
        deadline: "2026-06-01",
        followUpDate: "2026-06-01",
      }),
    ];
    expect(attentionDueCount(items, TODAY)).toBe(0);
  });
});
