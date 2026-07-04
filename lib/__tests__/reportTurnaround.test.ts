import { describe, expect, it } from "vitest";
import { reportTurnaround } from "@/lib/derived";
import { makeItem } from "./factory";

describe("reportTurnaround (#4) — report SLA turnaround", () => {
  it("computes avg/median/withinSlaPct/breachingCount from finishedDate to reportSentDate", () => {
    const items = [
      makeItem({
        id: "a",
        reportStatus: "sent",
        finishedDate: "2026-01-01",
        reportSentDate: "2026-01-05",
      }), // 4 days, within SLA
      makeItem({
        id: "b",
        reportStatus: "sent",
        finishedDate: "2026-01-01",
        reportSentDate: "2026-01-20",
      }), // 19 days, breaching
    ];

    const result = reportTurnaround(items);
    expect(result.measured).toBe(2);
    expect(result.total).toBe(2);
    expect(result.avgDays).toBe(12); // round((4 + 19) / 2) = 11.5 -> 12
    expect(result.medianDays).toBe(12); // avg of 4 and 19, rounded
    expect(result.withinSlaPct).toBe(50); // 1 of 2 within 7-day SLA
    expect(result.breachingCount).toBe(1);
    expect(result.slaDays).toBe(7);
  });

  it("falls back to publishDate when finishedDate is empty", () => {
    const items = [
      makeItem({
        id: "a",
        reportStatus: "sent",
        finishedDate: "",
        publishDate: "2026-02-01",
        reportSentDate: "2026-02-04",
      }), // 3 days from publishDate
    ];

    const result = reportTurnaround(items);
    expect(result.measured).toBe(1);
    expect(result.avgDays).toBe(3);
    expect(result.medianDays).toBe(3);
    expect(result.withinSlaPct).toBe(100);
    expect(result.breachingCount).toBe(0);
  });

  it("excludes items that are not reportStatus 'sent' or missing reportSentDate", () => {
    const items = [
      makeItem({
        id: "a",
        reportStatus: "not_sent",
        finishedDate: "2026-01-01",
        reportSentDate: "2026-01-05",
      }), // not sent -> excluded
      makeItem({
        id: "b",
        reportStatus: "sent",
        finishedDate: "2026-01-01",
        reportSentDate: "",
      }), // no reportSentDate -> excluded
    ];

    const result = reportTurnaround(items);
    expect(result.measured).toBe(0);
    expect(result.total).toBe(2);
    expect(result.avgDays).toBeNull();
    expect(result.medianDays).toBeNull();
    expect(result.withinSlaPct).toBeNull();
    expect(result.breachingCount).toBe(0);
  });

  it("reports null avg/median/withinSlaPct and zero breachingCount when no items are measured", () => {
    const result = reportTurnaround([]);
    expect(result.measured).toBe(0);
    expect(result.total).toBe(0);
    expect(result.avgDays).toBeNull();
    expect(result.medianDays).toBeNull();
    expect(result.withinSlaPct).toBeNull();
    expect(result.breachingCount).toBe(0);
    expect(result.slaDays).toBe(7);
  });

  it("excludes items where reportSentDate is before the base date (bad data)", () => {
    const items = [
      makeItem({
        id: "a",
        reportStatus: "sent",
        finishedDate: "2026-01-10",
        reportSentDate: "2026-01-05",
      }), // negative days -> excluded
    ];

    const result = reportTurnaround(items);
    expect(result.measured).toBe(0);
    expect(result.total).toBe(1);
    expect(result.avgDays).toBeNull();
  });
});
