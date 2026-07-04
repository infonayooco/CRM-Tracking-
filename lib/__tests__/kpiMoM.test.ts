import { describe, expect, it } from "vitest";
import { kpiMonthOverMonth, revenueMonthOverMonth } from "@/lib/derived";
import { makeCustomer, makeItem } from "./factory";

const customers = [makeCustomer({ id: "c1" })];

describe("kpiMonthOverMonth (#13) — per-tile month-over-month deltas", () => {
  it("totalItems delta = current month count - previous month count", () => {
    const items = [
      // current month (2026-06): 3 items
      makeItem({ id: "j1", publishDate: "2026-06-12", resultStatus: "achieved", rating: 5 }),
      makeItem({ id: "j2", publishDate: "2026-06-15", resultStatus: "achieved", rating: 3 }),
      makeItem({ id: "j3", publishDate: "2026-06-20", resultStatus: "achieved", rating: 0 }),
      // previous month (2026-05): 2 items
      makeItem({ id: "m1", publishDate: "2026-05-10", resultStatus: "achieved", rating: 2 }),
      makeItem({ id: "m2", publishDate: "2026-05-20", resultStatus: "in_progress", rating: 0 }),
    ];
    const mom = kpiMonthOverMonth(items, customers, "2026-06");
    expect(mom.totalItems.current).toBe(3);
    expect(mom.totalItems.previous).toBe(2);
    expect(mom.totalItems.delta).toBe(1);
    expect(mom.totalItems.hasPrevious).toBe(true);
  });

  it("achievedPct percentage-point delta: current 100% vs previous 50% => delta 50", () => {
    const items = [
      makeItem({ id: "j1", publishDate: "2026-06-12", resultStatus: "achieved" }),
      makeItem({ id: "j2", publishDate: "2026-06-15", resultStatus: "achieved" }),
      makeItem({ id: "m1", publishDate: "2026-05-10", resultStatus: "achieved" }),
      makeItem({ id: "m2", publishDate: "2026-05-20", resultStatus: "in_progress" }),
    ];
    const mom = kpiMonthOverMonth(items, customers, "2026-06");
    expect(mom.achievedPct.current).toBe(100);
    expect(mom.achievedPct.previous).toBe(50);
    expect(mom.achievedPct.delta).toBe(50);
  });

  it("hasPrevious=false when the previous month has no items", () => {
    const items = [
      makeItem({ id: "j1", publishDate: "2026-06-12", resultStatus: "achieved" }),
      makeItem({ id: "j2", publishDate: "2026-06-15", resultStatus: "achieved" }),
    ];
    const mom = kpiMonthOverMonth(items, customers, "2026-06");
    expect(mom.totalItems.hasPrevious).toBe(false);
    expect(mom.achievedPct.hasPrevious).toBe(false);
    expect(mom.avgRating.hasPrevious).toBe(false);
    expect(mom.totalCustomers.hasPrevious).toBe(false);
    expect(mom.reportSentPct.hasPrevious).toBe(false);
    // previous-month stats are still reported honestly as zero, not omitted
    expect(mom.totalItems.previous).toBe(0);
    expect(mom.achievedPct.previous).toBe(0);
  });

  it("avgRating delta is numeric (current avg - previous avg, rounded to 1 decimal)", () => {
    const items = [
      // current month (2026-06): rated 5 and 3 => avg 4.0
      makeItem({ id: "j1", publishDate: "2026-06-12", rating: 5 }),
      makeItem({ id: "j2", publishDate: "2026-06-15", rating: 3 }),
      // previous month (2026-05): rated 2 only => avg 2.0
      makeItem({ id: "m1", publishDate: "2026-05-10", rating: 2 }),
      makeItem({ id: "m2", publishDate: "2026-05-20", rating: 0 }),
    ];
    const mom = kpiMonthOverMonth(items, customers, "2026-06");
    expect(mom.avgRating.current).toBe(4);
    expect(mom.avgRating.previous).toBe(2);
    expect(mom.avgRating.delta).toBe(2);
    expect(mom.avgRating.hasPrevious).toBe(true);
  });

  it("old arity (no previousKey) still compares against the immediately preceding month (MoM)", () => {
    const items = [
      makeItem({ id: "j1", publishDate: "2026-06-12", resultStatus: "achieved" }),
      // adjacent previous month (2026-05) — must be picked up by the default arity
      makeItem({ id: "m1", publishDate: "2026-05-10", resultStatus: "in_progress" }),
      // same month last year (2025-06) — must be IGNORED by the default arity
      makeItem({ id: "y1", publishDate: "2025-06-10", resultStatus: "achieved" }),
      makeItem({ id: "y2", publishDate: "2025-06-15", resultStatus: "achieved" }),
    ];
    const mom = kpiMonthOverMonth(items, customers, "2026-06");
    expect(mom.totalItems.current).toBe(1);
    expect(mom.totalItems.previous).toBe(1); // only m1 (2026-05), not the two 2025-06 items
    expect(mom.totalItems.hasPrevious).toBe(true);
  });
});

describe("revenueMonthOverMonth / kpiMonthOverMonth (YoY comparison basis)", () => {
  it("revenueMonthOverMonth(items, '2026-06', '2025-06') compares June 2026 vs June 2025, not May 2026", () => {
    const items = [
      // current month (2026-06)
      makeItem({ id: "j1", publishDate: "2026-06-12", price: 1000 }),
      makeItem({ id: "j2", publishDate: "2026-06-20", price: 500 }),
      // same month last year (2025-06) — the YoY comparison base
      makeItem({ id: "y1", publishDate: "2025-06-10", price: 800 }),
      // adjacent previous month (2026-05) — must be IGNORED when a YoY key is passed
      makeItem({ id: "m1", publishDate: "2026-05-10", price: 999999 }),
    ];
    const yoy = revenueMonthOverMonth(items, "2026-06", "2025-06");
    expect(yoy.current).toBe(1500);
    expect(yoy.previous).toBe(800);
    expect(yoy.deltaPct).toBe(Math.round(((1500 - 800) / 800) * 100));
  });

  it("kpiMonthOverMonth(items, customers, '2026-06', '2025-06') computes YoY deltas, not MoM", () => {
    const items = [
      // current month (2026-06): 2 items, both achieved
      makeItem({ id: "j1", publishDate: "2026-06-12", resultStatus: "achieved", rating: 4 }),
      makeItem({ id: "j2", publishDate: "2026-06-20", resultStatus: "achieved", rating: 2 }),
      // same month last year (2025-06): 1 item, in progress — the YoY comparison base
      makeItem({ id: "y1", publishDate: "2025-06-10", resultStatus: "in_progress", rating: 0 }),
      // adjacent previous month (2026-05) — must be IGNORED when a YoY key is passed
      makeItem({ id: "m1", publishDate: "2026-05-10", resultStatus: "achieved" }),
      makeItem({ id: "m2", publishDate: "2026-05-11", resultStatus: "achieved" }),
    ];
    const yoy = kpiMonthOverMonth(items, customers, "2026-06", "2025-06");
    expect(yoy.totalItems.current).toBe(2);
    expect(yoy.totalItems.previous).toBe(1); // only y1 (2025-06), not the two 2026-05 items
    expect(yoy.totalItems.delta).toBe(1);
    expect(yoy.totalItems.hasPrevious).toBe(true);
    expect(yoy.achievedPct.current).toBe(100);
    expect(yoy.achievedPct.previous).toBe(0);
    expect(yoy.achievedPct.delta).toBe(100);
  });
});
