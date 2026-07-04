import { describe, expect, it } from "vitest";
import { revenueForecast } from "@/lib/derived";
import { makeItem } from "./factory";

const TODAY = new Date("2026-07-03T00:00:00.000Z");

describe("revenueForecast (#2) — forward revenue forecast reuses existing helpers", () => {
  it("committed = quoted: a QO with no INV contributes, a QO with an INV does not", () => {
    const items = [
      makeItem({ id: "a", qtNo: "QO-1", invNo: "", price: 100 }),
      makeItem({ id: "b", qtNo: "QO-2", invNo: "INV-1", price: 200 }),
    ];
    const forecast = revenueForecast(items, TODAY);
    expect(forecast.committed).toBe(100);
  });

  it("expectedRenewal = round(atRiskRevenue * rate/100) for a known renewal rate", () => {
    const items = [
      // decided renewals => historical rate of 50 (1 renewed + 1 lost)
      makeItem({ id: "renewed", renewalStatus: "renewed" }),
      makeItem({ id: "lost", renewalStatus: "lost" }),
      // pending renewal, expired (finishedDate in the past) => contributes to atRiskRevenue
      makeItem({ id: "pending", renewalStatus: "pending", finishedDate: "2020-01-01", price: 1000 }),
    ];
    const forecast = revenueForecast(items, TODAY);
    expect(forecast.renewalRate).toBe(50);
    expect(forecast.atRiskRevenue).toBe(1000);
    expect(forecast.expectedRenewal).toBe(Math.round(1000 * 0.5));
  });

  it("no decided renewals => renewalRate/expectedRenewal/forecastTotal are null, committed is still a number", () => {
    const items = [
      makeItem({ id: "a", qtNo: "QO-1", invNo: "", price: 300 }),
      // already invoiced (invNo set), so it does not also inflate `committed` —
      // this isolates the renewal-rate-null assertion from the quoted/invoiced split
      makeItem({
        id: "pending",
        qtNo: "QO-2",
        invNo: "INV-2",
        renewalStatus: "pending",
        finishedDate: "2020-01-01",
        price: 500,
      }),
    ];
    const forecast = revenueForecast(items, TODAY);
    expect(forecast.renewalRate).toBeNull();
    expect(forecast.expectedRenewal).toBeNull();
    expect(forecast.forecastTotal).toBeNull();
    expect(forecast.committed).toBe(300);
  });

  it("forecastTotal = committed + expectedRenewal when a renewal rate is present", () => {
    const items = [
      makeItem({ id: "a", qtNo: "QO-1", invNo: "", price: 400 }),
      makeItem({ id: "renewed", renewalStatus: "renewed" }),
      makeItem({ id: "lost", renewalStatus: "lost" }),
      makeItem({ id: "pending", renewalStatus: "pending", finishedDate: "2020-01-01", price: 1000 }),
    ];
    const forecast = revenueForecast(items, TODAY);
    expect(forecast.expectedRenewal).not.toBeNull();
    expect(forecast.forecastTotal).toBe(forecast.committed + (forecast.expectedRenewal as number));
  });
});
