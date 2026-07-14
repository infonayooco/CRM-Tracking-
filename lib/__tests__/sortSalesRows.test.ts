import { describe, expect, it } from "vitest";
import { sortSalesRows, type SalesSummaryRow } from "@/lib/derived";

const rows: SalesSummaryRow[] = [
  { label: "A", count: 2, revenue: 300 },
  { label: "B", count: 5, revenue: 100 },
  { label: "C", count: 2, revenue: 500 },
];

describe("sortSalesRows", () => {
  it("sorts by count desc, using revenue as the tiebreak", () => {
    // B has the most items; the two count-2 rows tie → higher revenue first
    expect(sortSalesRows(rows, "count", "desc").map((r) => r.label)).toEqual(["B", "C", "A"]);
  });

  it("sorts by count asc (tiebreak flips with direction)", () => {
    expect(sortSalesRows(rows, "count", "asc").map((r) => r.label)).toEqual(["A", "C", "B"]);
  });

  it("sorts by revenue desc", () => {
    expect(sortSalesRows(rows, "revenue", "desc").map((r) => r.label)).toEqual(["C", "A", "B"]);
  });

  it("sorts by revenue asc", () => {
    expect(sortSalesRows(rows, "revenue", "asc").map((r) => r.label)).toEqual(["B", "A", "C"]);
  });

  it("breaks a full tie by label and does not mutate the input", () => {
    const tied: SalesSummaryRow[] = [
      { label: "ข", count: 1, revenue: 10 },
      { label: "ก", count: 1, revenue: 10 },
    ];
    const snapshot = [...tied];
    expect(sortSalesRows(tied, "count", "desc").map((r) => r.label)).toEqual(["ก", "ข"]);
    expect(tied).toEqual(snapshot); // returns a new array; input untouched
  });
});
