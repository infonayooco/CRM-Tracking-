import { describe, expect, it } from "vitest";
import { priceIntegrityIssues } from "@/lib/derived";
import { makeCustomer, makeItem } from "./factory";

describe("priceIntegrityIssues (#5) — price data-integrity worklist", () => {
  it("flags only the delivered (published/done) line in a ฿0-total QT, not the not-started one", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q1", price: null, execStatus: "published" }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q1", price: null, execStatus: "not_started" }),
    ];
    const result = priceIntegrityIssues(items, [customer]);
    expect(result.unpricedDelivered.map((row) => row.item.id)).toEqual(["a"]);
    expect(result.negative).toHaveLength(0);
    expect(result.count).toBe(1);
  });

  it("does not flag anything when the QT has any priced line (false-positive guard)", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q2", price: 1000, execStatus: "done" }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q2", price: null, execStatus: "published" }),
    ];
    const result = priceIntegrityIssues(items, [customer]);
    expect(result.unpricedDelivered).toHaveLength(0);
    expect(result.negative).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it("flags a negative price as bad data and never as unpricedDelivered", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q3", price: -500, execStatus: "done" }),
    ];
    const result = priceIntegrityIssues(items, [customer]);
    expect(result.negative.map((row) => row.item.id)).toEqual(["a"]);
    expect(result.unpricedDelivered).toHaveLength(0);
    expect(result.count).toBe(1);
  });

  it("an empty board / all-priced board reports zero issues", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q4", price: 500, execStatus: "done" }),
    ];
    expect(priceIntegrityIssues([], [customer])).toEqual({ negative: [], unpricedDelivered: [], count: 0 });
    const result = priceIntegrityIssues(items, [customer]);
    expect(result.negative).toHaveLength(0);
    expect(result.unpricedDelivered).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  // Regression (BUG 2): grouping used to key only on qtNo, so two different
  // customers sharing the same qtNo were merged into one group — a priced
  // line for customer c2 masked a genuinely unpriced, delivered line for c1.
  it("does not let one customer's priced line mask another customer's unpriced delivered line under the same qtNo", () => {
    const c1 = makeCustomer({ id: "c1" });
    const c2 = makeCustomer({ id: "c2" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q1", price: null, execStatus: "published" }),
      makeItem({ id: "b", customerId: "c2", qtNo: "Q1", price: 1000, execStatus: "done" }),
    ];
    const result = priceIntegrityIssues(items, [c1, c2]);
    expect(result.unpricedDelivered.map((row) => row.item.id)).toEqual(["a"]);
    expect(result.count).toBe(1);
  });

  // Regression (BUG 3): the group guard used to sum SIGNED prices, so a +100
  // and -100 line netted to ฿0 and wrongly flagged the +100 delivered line as
  // unpriced. The guard must only look at whether ANY line is positively
  // priced, not whether the group nets to zero.
  it("does not flag a delivered line as unpriced when its QT nets to zero via a positive and a negative line", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "a", customerId: "c1", qtNo: "Q5", price: 100, execStatus: "published" }),
      makeItem({ id: "b", customerId: "c1", qtNo: "Q5", price: -100, execStatus: "published" }),
    ];
    const result = priceIntegrityIssues(items, [customer]);
    expect(result.unpricedDelivered.map((row) => row.item.id)).not.toContain("a");
    // the negative line is still separately surfaced as bad data
    expect(result.negative.map((row) => row.item.id)).toEqual(["b"]);
  });
});
