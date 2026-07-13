// The single source of truth for translating between the app's Customer/Item
// model (lib/types.ts) and Supabase rows. Every read runs through the
// normalize.ts guards (so DB values are re-validated, never blindly trusted),
// and every write applies the app's "" -> NULL conventions for date columns and
// customer_id (an orphan item has customerId "" which must become NULL).
import type { Database, Json } from "@/lib/supabase/database.types";
import { normalizeCustomer, normalizeItem } from "@/lib/normalize";
import type { Customer, CustomerInteraction, Item } from "@/lib/types";

// Writers build a COMPLETE row (every column set), so they return Row, which is
// still assignable to the Insert/Upsert parameter supabase-js expects.
type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
type ItemRow = Database["public"]["Tables"]["items"]["Row"];

// DB date/timestamptz columns are string | null; the app uses "" for "unset".
const fromDbDate = (value: string | null): string => value ?? "";
const toDbDate = (value: string): string | null => (value ? value : null);
// JSONB columns hold app arrays; cross the type boundary explicitly.
const toJson = (value: unknown): Json => value as Json;

export function rowToCustomer(row: CustomerRow): Customer {
  return normalizeCustomer({
    id: row.id,
    name: row.name,
    province: row.province,
    provinceCode: row.province_code ?? "",
    salesOwner: row.sales_owner,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    lineId: row.line_id,
    color: row.color,
    createdAt: row.created_at,
    interactions: (row.interactions as CustomerInteraction[] | null) ?? [],
  });
}

export function customerToRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: customer.name,
    province: customer.province,
    province_code: customer.provinceCode || null,
    sales_owner: customer.salesOwner,
    contact_person: customer.contactPerson,
    phone: customer.phone,
    email: customer.email,
    line_id: customer.lineId,
    color: customer.color,
    interactions: toJson(customer.interactions),
    created_at: customer.createdAt,
  };
}

export function rowToItem(row: ItemRow): Item {
  const item = normalizeItem({
    id: row.id,
    customerId: row.customer_id ?? "",
    qtNo: row.qt_no,
    invNo: row.inv_no,
    channel: row.channel,
    itemType: row.item_type,
    detail: row.detail,
    price: row.price,
    execStatus: row.exec_status,
    resultStatus: row.result_status,
    reportStatus: row.report_status,
    renewalStatus: row.renewal_status,
    target: row.target,
    actual: row.actual,
    metricName: row.metric_name,
    metricUnit: row.metric_unit,
    targetValue: row.target_value,
    actualValue: row.actual_value,
    reportSentDate: fromDbDate(row.report_sent_date),
    link: row.link,
    rating: row.rating,
    deadline: fromDbDate(row.deadline),
    publishDate: fromDbDate(row.publish_date),
    finishedDate: fromDbDate(row.finished_date),
    notes: row.notes,
    followUpDate: fromDbDate(row.follow_up_date),
    followUpNote: row.follow_up_note,
    priority: row.priority,
    progress: row.progress,
    checklist: (row.checklist as Item["checklist"] | null) ?? [],
    activity: (row.activity as Item["activity"] | null) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
  // Trust the DB foreign key for the customer link — normalizeItem would blank
  // it without the full customer set, which we deliberately don't require on
  // read (that validation is for untrusted CSV/localStorage import data).
  return { ...item, customerId: row.customer_id ?? "" };
}

export function itemToRow(item: Item): ItemRow {
  return {
    id: item.id,
    customer_id: item.customerId ? item.customerId : null,
    qt_no: item.qtNo,
    inv_no: item.invNo,
    channel: item.channel,
    item_type: item.itemType,
    detail: item.detail,
    price: item.price,
    exec_status: item.execStatus,
    result_status: item.resultStatus,
    report_status: item.reportStatus,
    renewal_status: item.renewalStatus,
    target: item.target,
    actual: item.actual,
    metric_name: item.metricName,
    metric_unit: item.metricUnit,
    target_value: item.targetValue,
    actual_value: item.actualValue,
    report_sent_date: toDbDate(item.reportSentDate),
    link: item.link,
    rating: item.rating,
    deadline: toDbDate(item.deadline),
    publish_date: toDbDate(item.publishDate),
    finished_date: toDbDate(item.finishedDate),
    notes: item.notes,
    follow_up_date: toDbDate(item.followUpDate),
    follow_up_note: item.followUpNote,
    priority: item.priority,
    progress: item.progress,
    checklist: toJson(item.checklist),
    activity: toJson(item.activity),
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}
