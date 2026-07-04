import { describe, expect, it } from "vitest";
import { customerConcentration } from "@/lib/derived";
import { makeCustomer, makeItem } from "./factory";

describe("customerConcentration (#12) — client revenue Pareto / dependency risk", () => {
  it("ranks the top customer and computes top-1 / top-3 revenue share", () => {
    const big = makeCustomer({ id: "big", name: "ลูกค้าใหญ่" });
    const mid = makeCustomer({ id: "mid", name: "ลูกค้ากลาง" });
    const small = makeCustomer({ id: "small", name: "ลูกค้าเล็ก" });
    const items = [
      makeItem({ id: "a", customerId: "big", price: 6000 }),
      makeItem({ id: "b", customerId: "mid", price: 3000 }),
      makeItem({ id: "c", customerId: "small", price: 1000 }),
    ];

    const result = customerConcentration(items, [big, mid, small]);

    expect(result.total).toBe(10000);
    expect(result.topName).toBe("ลูกค้าใหญ่");
    expect(result.topRevenue).toBe(6000);
    expect(result.topPct).toBe(60);
    expect(result.top3Pct).toBe(100);
    expect(result.customerCount).toBe(3);
  });

  it("excludes a customer with zero revenue from customerCount", () => {
    const big = makeCustomer({ id: "big", name: "ลูกค้าใหญ่" });
    const mid = makeCustomer({ id: "mid", name: "ลูกค้ากลาง" });
    const small = makeCustomer({ id: "small", name: "ลูกค้าเล็ก" });
    const zero = makeCustomer({ id: "zero", name: "ลูกค้าไม่มีรายได้" });
    const items = [
      makeItem({ id: "a", customerId: "big", price: 6000 }),
      makeItem({ id: "b", customerId: "mid", price: 3000 }),
      makeItem({ id: "c", customerId: "small", price: 1000 }),
      makeItem({ id: "d", customerId: "zero", price: 0 }),
    ];

    const result = customerConcentration(items, [big, mid, small, zero]);

    expect(result.customerCount).toBe(3);
    expect(result.total).toBe(10000);
  });

  it("returns zeros and a 'ไม่ระบุ' fallback when there is no revenue", () => {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้าทดสอบ" });
    const items = [makeItem({ id: "a", customerId: "c1", price: 0 })];

    const result = customerConcentration(items, [customer]);

    expect(result.total).toBe(0);
    expect(result.topPct).toBe(0);
    expect(result.top3Pct).toBe(0);
    expect(result.customerCount).toBe(0);
    expect(result.topName).toBe("ไม่ระบุ");
  });

  it("returns zeros for an entirely empty item list", () => {
    const result = customerConcentration([], []);

    expect(result.total).toBe(0);
    expect(result.topPct).toBe(0);
    expect(result.top3Pct).toBe(0);
    expect(result.customerCount).toBe(0);
    expect(result.topName).toBe("ไม่ระบุ");
  });
});
