import { describe, expect, it } from "vitest";
import { customerToRow, itemToRow, rowToCustomer, rowToItem } from "@/lib/data/mappers";
import { normalizeCustomer, normalizeItem } from "@/lib/normalize";

// The mapper must be a lossless round-trip for normalized data:
//   customer === rowToCustomer(customerToRow(customer))
//   item     === rowToItem(itemToRow(item))
describe("supabase mappers", () => {
  const customer = normalizeCustomer({
    id: "cus_1",
    name: "ลูกค้า ก",
    province: "ขอนแก่น",
    salesOwner: "พี่ไซน์",
    contactPerson: "คุณเอ",
    phone: "0800000000",
    email: "a@example.com",
    lineId: "@a",
    color: "#2563eb",
    createdAt: "2026-01-01T00:00:00.000Z",
    interactions: [{ id: "intx_1", date: "2026-01-02", type: "call", note: "โทรคุย" }],
  });

  const customerIds = new Set([customer.id]);

  const item = normalizeItem(
    {
      id: "item_1",
      customerId: customer.id,
      qtNo: "QT-001",
      invNo: "INV-001",
      channel: "facebook",
      itemType: "โพสต์",
      detail: "รายละเอียด",
      price: 1500,
      execStatus: "in_progress",
      resultStatus: "achieved",
      reportStatus: "sent",
      renewalStatus: "renewed",
      target: "ยอด",
      actual: "ผล",
      metricName: "reach",
      metricUnit: "คน",
      targetValue: 1000,
      actualValue: 1200,
      reportSentDate: "2026-02-01",
      link: "https://example.com/x",
      rating: 4,
      deadline: "2026-01-15",
      publishDate: "2026-01-10",
      finishedDate: "2026-01-20",
      notes: "โน้ต",
      followUpDate: "2026-03-01",
      followUpNote: "ตามงาน",
      priority: "high",
      progress: 50,
      checklist: [{ id: "ck_1", text: "ทำ", done: true }],
      activity: [{ ts: "2026-01-01T00:00:00.000Z", text: "สร้าง" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    },
    customerIds,
  );

  it("round-trips a fully-populated customer", () => {
    expect(rowToCustomer(customerToRow(customer))).toEqual(customer);
  });

  it("writes province_code and resolves it from legacy text on read", () => {
    // Write path: the picker-selected code lands in the DB column.
    expect(customerToRow(customer).province_code).toBe("TH-40");
    // Legacy read path: a row with NULL province_code but a matching Thai name
    // is self-healed to a code (client-side reconciliation).
    const legacyRow = { ...customerToRow(customer), province_code: null };
    expect(rowToCustomer(legacyRow).provinceCode).toBe("TH-40");
  });

  it("round-trips a fully-populated item", () => {
    expect(rowToItem(itemToRow(item))).toEqual(item);
  });

  it("preserves a valid customer link on read without needing the customer set", () => {
    // Regression guard: rowToItem must trust the DB FK, not blank customerId.
    expect(rowToItem(itemToRow(item)).customerId).toBe(customer.id);
  });

  it("maps empty dates and an orphan customerId to NULL and back to \"\"", () => {
    const orphan = normalizeItem({
      id: "item_2",
      customerId: "",
      itemType: "งาน",
      price: null,
      deadline: "",
      publishDate: "",
      finishedDate: "",
      reportSentDate: "",
      followUpDate: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const row = itemToRow(orphan);
    expect(row.customer_id).toBeNull();
    expect(row.deadline).toBeNull();
    expect(row.report_sent_date).toBeNull();
    expect(rowToItem(row)).toEqual(orphan);
  });
});
