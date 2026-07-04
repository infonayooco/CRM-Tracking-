import { describe, expect, it } from "vitest";
import { attainmentSummary } from "@/lib/derived";
import { makeItem } from "./factory";

describe("attainmentSummary (#6) — numeric goal rollup", () => {
  it("aggregates target vs actual per metric+unit and never sums across units", () => {
    const items = [
      makeItem({ id: "a", metricName: "เข้าถึง", metricUnit: "ครั้ง", targetValue: 100, actualValue: 122 }),
      makeItem({ id: "b", metricName: "เข้าถึง", metricUnit: "ครั้ง", targetValue: 200, actualValue: 200 }),
      makeItem({ id: "c", metricName: "เข้าถึง", metricUnit: "%", targetValue: 10, actualValue: 8 }),
      makeItem({ id: "d", metricName: "จอง", metricUnit: "", targetValue: 50, actualValue: 40 }),
      makeItem({ id: "e", metricName: "จอง", metricUnit: "", targetValue: 10, actualValue: null }), // no actual
      makeItem({ id: "f", metricName: "", metricUnit: "", targetValue: 5, actualValue: 5 }), // no metric name
    ];

    const summary = attainmentSummary(items);
    expect(summary.total).toBe(6);
    expect(summary.measured).toBe(4); // a, b, c, d

    const reachTimes = summary.groups.find((g) => g.metric === "เข้าถึง" && g.unit === "ครั้ง");
    expect(reachTimes?.count).toBe(2);
    expect(reachTimes?.totalTarget).toBe(300);
    expect(reachTimes?.totalActual).toBe(322);
    expect(reachTimes?.attainmentPct).toBe(107);

    // same metric name, different unit => a separate group (not merged)
    const reachPct = summary.groups.find((g) => g.metric === "เข้าถึง" && g.unit === "%");
    expect(reachPct?.count).toBe(1);
    expect(reachPct?.attainmentPct).toBe(80);

    const booking = summary.groups.find((g) => g.metric === "จอง");
    expect(booking?.count).toBe(1); // only the item with both numbers
    expect(booking?.attainmentPct).toBe(80);
  });

  it("reports null attainment when the target sums to zero", () => {
    const items = [makeItem({ id: "z", metricName: "x", metricUnit: "u", targetValue: 0, actualValue: 5 })];
    expect(attainmentSummary(items).groups[0].attainmentPct).toBeNull();
  });

  it("has zero coverage when no item carries numbers", () => {
    const summary = attainmentSummary([makeItem({ id: "n" })]);
    expect(summary.measured).toBe(0);
    expect(summary.groups).toHaveLength(0);
    expect(summary.total).toBe(1);
  });
});
