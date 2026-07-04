import { describe, expect, it } from "vitest";
import { unbilledQuotations } from "@/lib/derived";
import { makeCustomer, makeItem } from "./factory";

const TODAY = new Date("2026-01-31T00:00:00.000Z");

describe("unbilledQuotations (#6) — unbilled-quotation worklist (QO→INV)", () => {
  it("a QT with no INV lines at all is fully unbilled", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q1", invNo: "", price: 1000 }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q1", invNo: "", price: 2000 }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.qtNo).toBe("Q1");
    expect(row.customerId).toBe("c1");
    expect(row.itemCount).toBe(2);
    expect(row.revenue).toBe(3000);
    expect(row.billedRevenue).toBe(0);
    expect(row.unbilledRevenue).toBe(3000);
    expect(row.status).toBe("unbilled");
  });

  it("a QT with some but not all lines invoiced is partial, with exact billed/unbilled split", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q2", invNo: "INV1", price: 1000 }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q2", invNo: "", price: 500 }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.status).toBe("partial");
    expect(row.revenue).toBe(1500);
    expect(row.billedRevenue).toBe(1000);
    expect(row.unbilledRevenue).toBe(500);
  });

  it("a fully-billed QT (every line has an INV no) is excluded entirely", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q3", invNo: "INV1", price: 1000 }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q3", invNo: "INV2", price: 2000 }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(0);
    expect(result.count).toBe(0);
    expect(result.totalUnbilled).toBe(0);
  });

  it("items with an empty qtNo are never treated as a billable QO", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [makeItem({ id: "a", customerId: "c1", qtNo: "", invNo: "", price: 1000 })];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(0);
  });

  it("a QT with zero total revenue is excluded even with unbilled lines (no real money to bill)", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q4", invNo: "", price: 0 }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q4", invNo: "", price: null }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(0);
  });

  it("ageDays uses the latest finishedDate (else publishDate) across the QT's lines", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({
        id: "a",
        customerId: "c1",
        qtNo: "Q5",
        invNo: "",
        price: 1000,
        finishedDate: "2026-01-01",
        publishDate: "",
      }),
      makeItem({
        id: "b",
        customerId: "c1",
        qtNo: "Q5",
        invNo: "",
        price: 500,
        finishedDate: "",
        publishDate: "2026-01-20",
      }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(1);
    // latest per-line date is 2026-01-20 (line b's publishDate fallback) — 11 days before TODAY
    expect(result.rows[0].ageDays).toBe(11);
  });

  it("ageDays is null when no line has a parseable finishedDate or publishDate", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({
        id: "a",
        customerId: "c1",
        qtNo: "Q6",
        invNo: "",
        price: 1000,
        finishedDate: "",
        publishDate: "",
      }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ageDays).toBeNull();
  });

  it("sorts rows by unbilledRevenue desc and reports the correct totalUnbilled/count", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q-small", invNo: "", price: 500 }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q-big", invNo: "", price: 5000 }),
      makeItem({ id: "c", customerId: "c1", qtNo: "Q-mid", invNo: "", price: 1500 }),
    ];
    const result = unbilledQuotations(items, [customer], TODAY);
    expect(result.rows.map((row) => row.qtNo)).toEqual(["Q-big", "Q-mid", "Q-small"]);
    expect(result.count).toBe(3);
    expect(result.totalUnbilled).toBe(7000);
  });

  it("the same qtNo under different customers is kept as separate rows, not merged", () => {
    const customers = [makeCustomer({ id: "c1" }), makeCustomer({ id: "c2", name: "ลูกค้า B" })];
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q-shared", invNo: "", price: 1000 }),
      makeItem({ id: "b", customerId: "c2", qtNo: "Q-shared", invNo: "", price: 2000 }),
    ];
    const result = unbilledQuotations(items, customers, TODAY);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.customerId).sort()).toEqual(["c1", "c2"]);
  });

  it("falls back to the placeholder customer name when the customer record is missing", () => {
    const items = [makeItem({ id: "a", customerId: "ghost", qtNo: "Q7", invNo: "", price: 1000 })];
    const result = unbilledQuotations(items, [], TODAY);
    expect(result.rows[0].customerName).toBe("ไม่ระบุลูกค้า");
  });
});
