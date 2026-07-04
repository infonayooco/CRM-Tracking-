import { describe, expect, it } from "vitest";
import { customerHealth } from "@/lib/derived";
import { makeCustomer, makeItem } from "./factory";

const TODAY = new Date("2026-07-03T00:00:00.000Z");

describe("customerHealth (#1) — per-customer account-health / churn-risk scorecard", () => {
  it("a customer with a lost renewal is at-risk regardless of other signals", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", renewalStatus: "lost", resultStatus: "achieved" }),
    ];
    const row = customerHealth(items, [customer], TODAY).find((r) => r.customerId === "c1")!;
    expect(row.tier).toBe("at-risk");
    expect(row.reason).toBe("เสียลูกค้า");
    expect(row.lostCount).toBe(1);
  });

  it("an expired finishedDate with a pending renewal is at-risk (expiredPendingCount>0)", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", renewalStatus: "pending", finishedDate: "2020-01-01" }),
    ];
    const row = customerHealth(items, [customer], TODAY).find((r) => r.customerId === "c1")!;
    expect(row.expiredPendingCount).toBe(1);
    expect(row.tier).toBe("at-risk");
    expect(row.reason).toBe("หมดอายุรอต่อ 1 งาน");
  });

  it("a measured achievedPct below the floor is at-risk even with no renewal risk", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", renewalStatus: "renewed", resultStatus: "achieved" }),
      makeItem({ id: "b", customerId: "c1", renewalStatus: "renewed", resultStatus: "not_collected" }),
      makeItem({ id: "c", customerId: "c1", renewalStatus: "renewed", resultStatus: "not_collected" }),
      makeItem({ id: "d", customerId: "c1", renewalStatus: "renewed", resultStatus: "not_collected" }),
      makeItem({ id: "e", customerId: "c1", renewalStatus: "renewed", resultStatus: "not_collected" }),
    ];
    const row = customerHealth(items, [customer], TODAY).find((r) => r.customerId === "c1")!;
    expect(row.achievedPct).toBe(20);
    expect(row.tier).toBe("at-risk");
    expect(row.reason).toBe("บรรลุผลต่ำ (20%)");
  });

  it("all renewed with high achievement is healthy", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({
        id: "a",
        customerId: "c1",
        renewalStatus: "renewed",
        resultStatus: "achieved",
        reportStatus: "sent",
      }),
      makeItem({
        id: "b",
        customerId: "c1",
        renewalStatus: "renewed",
        resultStatus: "achieved",
        reportStatus: "sent",
      }),
    ];
    const row = customerHealth(items, [customer], TODAY).find((r) => r.customerId === "c1")!;
    expect(row.tier).toBe("healthy");
    expect(row.reason).toBe("แข็งแรง");
  });

  it("a customer with zero items reports null coverage, never a false 0/100", () => {
    const customerWithItems = makeCustomer({ id: "c1" });
    const customerNoItems = makeCustomer({ id: "c2", name: "ลูกค้าใหม่" });
    const items = [makeItem({ id: "a", customerId: "c1" })];

    const row = customerHealth(items, [customerWithItems, customerNoItems], TODAY).find(
      (r) => r.customerId === "c2",
    )!;
    expect(row.achievedPct).toBeNull();
    expect(row.reportSentPct).toBeNull();
    expect(row.avgRating).toBeNull();
    expect(row.ratedCount).toBe(0);
    expect(row.revenue).toBe(0);
    expect(row.revenueAtRisk).toBe(0);
    expect(row.tier).toBe("healthy");
    expect(row.reason).toBe("แข็งแรง");
  });

  it("ranks at-risk accounts by revenueAtRisk desc, matching the panel's sort", () => {
    const customers = [
      makeCustomer({ id: "c1", name: "ลูกค้า A" }),
      makeCustomer({ id: "c2", name: "ลูกค้า B" }),
      makeCustomer({ id: "c3", name: "ลูกค้า C" }),
    ];
    const items = [
      makeItem({ id: "a", customerId: "c1", price: 500, renewalStatus: "pending", finishedDate: "2020-01-01" }),
      makeItem({ id: "b", customerId: "c2", price: 2000, renewalStatus: "pending", finishedDate: "2020-01-01" }),
      makeItem({ id: "c", customerId: "c3", price: 1200, renewalStatus: "pending", finishedDate: "2020-01-01" }),
    ];
    const rows = customerHealth(items, customers, TODAY);
    expect(rows.every((row) => row.tier === "at-risk")).toBe(true);

    const ranked = rows
      .filter((row) => row.tier !== "healthy")
      .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || b.revenue - a.revenue);
    expect(ranked.map((row) => row.customerId)).toEqual(["c2", "c3", "c1"]);
  });
});
