import { describe, expect, it } from "vitest";
import { ownerPerformance } from "@/lib/derived";
import { parseTeamCsv } from "@/lib/parseTeamCsv";
import { SEED_CSV } from "@/lib/seedCsv";
import { makeCustomer, makeItem } from "./factory";

describe("ownerPerformance — seed parity", () => {
  const { items, customers } = parseTeamCsv(SEED_CSV);
  const rows = ownerPerformance(items, customers);

  it("ranks พี่ไซน์ first with 115 items (key-person concentration)", () => {
    expect(rows[0].owner).toContain("ไซน์");
    expect(rows[0].count).toBe(115);
  });

  it("every item is attributed to exactly one owner row", () => {
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(items.length);
  });

  it("owner revenue rows sum to the overall revenue total", () => {
    const overall = items.reduce((total, item) => total + (item.price || 0), 0);
    expect(rows.reduce((total, row) => total + row.revenue, 0)).toBe(overall);
  });
});

describe("ownerPerformance — renewal rate from decided outcomes only", () => {
  const customers = [makeCustomer({ id: "c1", salesOwner: "เอ" })];

  it("2 renewed + 1 lost => 67%; pending is ignored", () => {
    const items = [
      makeItem({ id: "a", customerId: "c1", renewalStatus: "renewed" }),
      makeItem({ id: "b", customerId: "c1", renewalStatus: "renewed" }),
      makeItem({ id: "c", customerId: "c1", renewalStatus: "lost" }),
      makeItem({ id: "d", customerId: "c1", renewalStatus: "pending" }),
    ];
    const row = ownerPerformance(items, customers)[0];
    expect(row.count).toBe(4);
    expect(row.renewedCount).toBe(2);
    expect(row.lostCount).toBe(1);
    expect(row.renewalRate).toBe(67);
  });

  it("renewalRate is null when no renewal is decided yet", () => {
    const items = [makeItem({ id: "a", customerId: "c1", renewalStatus: "pending" })];
    expect(ownerPerformance(items, customers)[0].renewalRate).toBeNull();
  });

  it("falls back to 'ไม่ระบุ' when the customer/owner is missing", () => {
    const orphan = ownerPerformance([makeItem({ id: "x", customerId: "ghost" })], customers);
    expect(orphan[0].owner).toBe("ไม่ระบุ");
  });
});
