import { describe, expect, it } from "vitest";
import { dashboardStats, revenueBreakdown } from "@/lib/derived";
import { serializeTeamCsv } from "@/lib/exportData";
import { parseTeamCsv } from "@/lib/parseTeamCsv";
import { SEED_CSV } from "@/lib/seedCsv";
import { makeItem } from "./factory";

const seed = parseTeamCsv(SEED_CSV);
const SEED_TOTAL = 1_294_700;

describe("revenueBreakdown — money identities must always hold", () => {
  it("total equals the sum of every item price (seed = ฿1,294,700)", () => {
    expect(revenueBreakdown(seed.items).total).toBe(SEED_TOTAL);
  });

  it("invoiced + quoted === total (the recognition split loses no revenue)", () => {
    const b = revenueBreakdown(seed.items);
    expect(b.invoiced + b.quoted).toBe(b.total);
  });

  it("netOfVat + vat === total, and netOfVat = round(total / 1.07)", () => {
    const b = revenueBreakdown(seed.items);
    expect(b.netOfVat + b.vat).toBe(b.total);
    expect(b.netOfVat).toBe(Math.round(SEED_TOTAL / 1.07));
  });

  it("a QT is invoiced if ANY of its lines carries an INV no", () => {
    const items = [
      makeItem({ id: "a", qtNo: "QO-1", invNo: "", price: 100 }),
      makeItem({ id: "b", qtNo: "QO-1", invNo: "INV-9", price: 200 }),
      makeItem({ id: "c", qtNo: "QO-2", invNo: "", price: 50 }),
    ];
    const b = revenueBreakdown(items);
    expect(b.total).toBe(350);
    expect(b.invoiced).toBe(300); // whole QO-1 (100 + 200)
    expect(b.quoted).toBe(50); // QO-2 only
  });

  it("items without a QT are each their own group, not merged", () => {
    const items = [
      makeItem({ id: "a", qtNo: "", invNo: "INV-1", price: 100 }),
      makeItem({ id: "b", qtNo: "", invNo: "", price: 200 }),
    ];
    const b = revenueBreakdown(items);
    expect(b.total).toBe(300);
    expect(b.invoiced).toBe(100); // only the line that carries an INV
    expect(b.quoted).toBe(200);
  });
});

describe("dashboardStats — seed headline numbers", () => {
  const stats = dashboardStats(seed.items, seed.customers);

  it("counts 144 items and 34 customers", () => {
    expect(stats.totalItems).toBe(144);
    expect(stats.totalCustomers).toBe(34);
  });

  it("revenue equals the seed total", () => {
    expect(stats.revenue).toBe(SEED_TOTAL);
  });

  it("achieved% and reportSent% stay within 0..100", () => {
    expect(stats.achievedPct).toBeGreaterThanOrEqual(0);
    expect(stats.achievedPct).toBeLessThanOrEqual(100);
    expect(stats.reportSentPct).toBeGreaterThanOrEqual(0);
    expect(stats.reportSentPct).toBeLessThanOrEqual(100);
  });
});

describe("CSV export → import round-trip preserves the core ledger", () => {
  const csv = serializeTeamCsv(seed.customers, seed.items);
  const reparsed = parseTeamCsv(csv);

  it("item count, customer count, and total revenue survive the round-trip", () => {
    expect(reparsed.items.length).toBe(seed.items.length);
    expect(reparsed.customers.length).toBe(seed.customers.length);
    expect(reparsed.items.reduce((sum, item) => sum + (item.price || 0), 0)).toBe(SEED_TOTAL);
  });

  it("re-serializing the reparsed data is byte-identical (stable round-trip)", () => {
    expect(serializeTeamCsv(reparsed.customers, reparsed.items)).toBe(csv);
  });

  it("import tolerates a leading UTF-8 BOM (Excel-saved / our own BOM'd export)", () => {
    const bom = String.fromCharCode(0xfeff);
    const parsed = parseTeamCsv(bom + csv);
    expect(parsed.items.length).toBe(seed.items.length);
    expect(parsed.customers.length).toBe(seed.customers.length);
    expect(parsed.items.reduce((sum, item) => sum + (item.price || 0), 0)).toBe(SEED_TOTAL);
  });
});
