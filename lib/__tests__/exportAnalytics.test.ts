import { describe, expect, it } from "vitest";
import { serializeAnalyticsCsv } from "@/lib/exportAnalytics";
import { parseCsvRows } from "@/lib/parseTeamCsv";
import { makeCustomer, makeItem } from "./factory";

const TODAY = new Date("2026-07-03T00:00:00.000Z");

const SECTION_TITLES = [
  "สรุปรายได้",
  "ผลงานตามเจ้าของงานขาย",
  "ผลงานตามช่องทาง",
  "ผลงานตามประเภทงาน",
  "สุขภาพลูกค้า (เสี่ยง)",
  "ใบเสนอราคาค้างวางบิล",
  "ผลการต่ออายุ",
];

const customers = [
  makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "เอ" }),
  makeCustomer({ id: "c2", name: "ลูกค้า B", salesOwner: "บี" }),
];

// A: renewed & rated (5⭐), billed to Q1 partially by B.
// B: lost & unrated, same QT as A (Q1) -> Q1 partially billed.
// C: pending renewal, unrated, on its own QT (Q2) -> fully unbilled.
// All three share finishedDate 2026-01-01, well before TODAY, so
// renewalOutcomes sees all three as "expired" (decided: 1 renewed + 1 lost).
const items = [
  makeItem({
    id: "a",
    customerId: "c1",
    qtNo: "Q1",
    invNo: "",
    channel: "web",
    itemType: "บทความ",
    price: 1000,
    rating: 5,
    resultStatus: "achieved",
    reportStatus: "sent",
    renewalStatus: "renewed",
    finishedDate: "2026-01-01",
  }),
  makeItem({
    id: "b",
    customerId: "c1",
    qtNo: "Q1",
    invNo: "INV1",
    channel: "web",
    itemType: "บทความ",
    price: 500,
    rating: 0,
    resultStatus: "not_collected",
    reportStatus: "not_sent",
    renewalStatus: "lost",
    finishedDate: "2026-01-01",
  }),
  makeItem({
    id: "c",
    customerId: "c2",
    qtNo: "Q2",
    invNo: "",
    channel: "facebook",
    itemType: "วิดีโอ",
    price: 2000,
    rating: 0,
    resultStatus: "achieved",
    reportStatus: "sent",
    renewalStatus: "pending",
    finishedDate: "2026-01-01",
  }),
];

const csv = serializeAnalyticsCsv(items, customers, TODAY);
const rows = parseCsvRows(csv);

function findRow(firstCell: string): string[] | undefined {
  return rows.find((row) => row[0] === firstCell);
}

describe("serializeAnalyticsCsv", () => {
  it("contains every labeled section title", () => {
    for (const title of SECTION_TITLES) {
      expect(rows.some((row) => row[0] === title)).toBe(true);
    }
  });

  it("parses into rows, and the revenue summary total matches the sum of item prices", () => {
    expect(rows.length).toBeGreaterThan(0);
    const totalRow = findRow("รวมทั้งหมด");
    expect(totalRow).toBeDefined();
    const expectedTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
    expect(Number(totalRow![1])).toBe(expectedTotal);
  });

  it("an owner's row carries the expected achieved/report/rating/renewal numbers", () => {
    const ownerRow = findRow("เอ");
    expect(ownerRow).toBeDefined();
    // [owner, count, revenue, achievedPct, reportSentPct, avgRating, renewalRate]
    expect(ownerRow).toEqual(["เอ", "2", "1500", "50", "50", "5", "50"]);
  });

  it("a channel's row carries the expected count/achieved/report numbers", () => {
    const channelRow = findRow("Facebook");
    expect(channelRow).toBeDefined();
    // [label, count, achievedPct, reportSentPct, avgRating] — single unrated item (achieved, sent)
    expect(channelRow).toEqual(["Facebook", "1", "100", "100", ""]);
  });

  it("an unrated group's avgRating serializes as an empty cell, not 'null'/'NaN'", () => {
    // Owner "บี" has a single unrated item with a pending (undecided) renewal —
    // both avgRating and renewalRate must be empty cells, never "null"/"NaN"/"0".
    const ownerRow = findRow("บี");
    expect(ownerRow).toBeDefined();
    const [, , , , , avgRating, renewalRate] = ownerRow!;
    expect(avgRating).toBe("");
    expect(renewalRate).toBe("");
    expect(avgRating).not.toBe("NaN");
    expect(avgRating).not.toBe("null");

    // Same null-honesty check on the itemType table (วิดีโอ has only the unrated item C).
    const itemTypeRow = findRow("วิดีโอ");
    expect(itemTypeRow).toBeDefined();
    expect(itemTypeRow![4]).toBe("");
  });

  it("includes the unbilled-quotations and renewal-outcomes rows with correct figures", () => {
    const q1Row = findRow("Q1");
    expect(q1Row).toBeDefined();
    // [qtNo, customerName, status, unbilledRevenue, ageDays]
    expect(q1Row![1]).toBe("ลูกค้า A");
    expect(q1Row![2]).toBe("วางบิลบางส่วน");
    // Q1 revenue 1500 (a:1000 + b:500), billed 500 (only b carries an INV no) -> unbilled 1000
    expect(Number(q1Row![3])).toBe(1000);

    const q2Row = findRow("Q2");
    expect(q2Row).toBeDefined();
    expect(q2Row![2]).toBe("ยังไม่วางบิล");
    expect(Number(q2Row![3])).toBe(2000);

    // [total, renewed, lost, pending, rate] — 3 expired, 1 renewed, 1 lost, 1 pending, rate 50%
    const outcomesRow = findRow("3");
    expect(outcomesRow).toEqual(["3", "1", "1", "1", "50"]);
  });
});
