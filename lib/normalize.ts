import {
  CHANNEL_MAP,
  CUSTOMER_COLORS,
  EXEC_MAP,
  PRIORITY_MAP,
  REPORT_MAP,
  RESULT_MAP,
  STORE_VERSION,
} from "./constants";
import { PROVINCE_BY_CODE, PROVINCE_CODE_BY_TH, provinceNameTh } from "./provinces";
import type {
  ChannelKey,
  Customer,
  ExecStatus,
  InteractionType,
  Item,
  Metric,
  PriorityKey,
  RenewalStatus,
  Store,
} from "./types";

let counter = 0;

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${counter++}`;
}

export function nowISO() {
  return new Date().toISOString();
}

export function clampInt(value: unknown, lo: number, hi: number) {
  let n = Number.parseInt(String(value), 10);
  if (Number.isNaN(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
}

export function safeHex(color: unknown, fallback = "#2563eb") {
  const value = String(color || "");
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
}

export function safeUrl(url: unknown) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

export function safeId(value: unknown, prefix = "id") {
  const id = String(value || "");
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : uid(prefix);
}

export function execToProgress(status: ExecStatus) {
  return { not_started: 0, in_progress: 50, published: 90, done: 100 }[status] ?? 0;
}

export function createEmptyStore(): Store {
  return {
    version: STORE_VERSION,
    customers: [],
    items: [],
    members: [],
    settings: { currentUser: "" },
  };
}

// Reconcile a customer's province code and free-text name into a consistent pair.
// A valid code wins — the name is derived from it, which keeps the two in sync and
// closes the migration's "stale-on-edit" gap. Otherwise match the free-text Thai
// name back to a code; unmatched legacy text is preserved with an empty code.
function resolveProvince(
  code: string | null | undefined,
  name: string | null | undefined,
): { province: string; provinceCode: string } {
  const trimmedCode = String(code ?? "").trim();
  if (trimmedCode && PROVINCE_BY_CODE[trimmedCode]) {
    return { province: provinceNameTh(trimmedCode), provinceCode: trimmedCode };
  }
  const trimmedName = String(name ?? "").trim();
  const matchedCode = PROVINCE_CODE_BY_TH[trimmedName];
  if (matchedCode) {
    return { province: trimmedName, provinceCode: matchedCode };
  }
  return { province: trimmedName, provinceCode: "" };
}

export function normalizeCustomer(customer: Partial<Customer>): Customer {
  const { province, provinceCode } = resolveProvince(customer.provinceCode, customer.province);
  return {
    id: safeId(customer.id, "cus"),
    name: String(customer.name || "(ไม่มีชื่อลูกค้า)").trim(),
    province,
    provinceCode,
    salesOwner: String(customer.salesOwner || "").trim(),
    contactPerson: String(customer.contactPerson ?? "").trim(),
    phone: String(customer.phone ?? "").trim(),
    email: String(customer.email ?? "").trim(),
    lineId: String(customer.lineId ?? "").trim(),
    color: safeHex(customer.color),
    createdAt: customer.createdAt || nowISO(),
    interactions: Array.isArray(customer.interactions)
      ? customer.interactions.map((entry) => ({
          id: safeId(entry.id, "intx"),
          date: String(entry.date || "").trim(),
          type: isInteractionType(entry.type) ? entry.type : "note",
          note: String(entry.note || "").trim(),
        }))
      : [],
  };
}

type ItemInput = Partial<
  Omit<
    Item,
    "channel" | "execStatus" | "resultStatus" | "reportStatus" | "renewalStatus" | "priority" | "progress"
  >
> & {
  channel?: unknown;
  execStatus?: unknown;
  resultStatus?: unknown;
  reportStatus?: unknown;
  renewalStatus?: unknown;
  priority?: unknown;
  progress?: unknown;
};

// Caps the persisted activity log per item so the localStorage blob does not
// grow unbounded — only the most recent entries matter for the UI.
const MAX_ACTIVITY = 50;

// Reconcile an item's metric list with the legacy scalar metric columns.
// `metrics` (when provided as an array — even empty) is the source of truth: it
// respects an explicitly-empty list (user removed all rows). When absent
// (legacy rows / CSV parse / pre-migration DB), synthesize a single metric from
// the scalar fields. Fully-empty rows are dropped so blank rows aren't persisted.
function resolveItemMetrics(item: ItemInput): Metric[] {
  const toMetric = (
    name: unknown,
    unit: unknown,
    target: unknown,
    actual: unknown,
    id?: unknown,
  ): Metric => ({
    id: safeId(typeof id === "string" ? id : undefined, "metric"),
    name: String(name || "").trim(),
    unit: String(unit || "").trim(),
    targetValue: normalizePrice(target),
    actualValue: normalizePrice(actual),
  });
  const isEmpty = (m: Metric) => !m.name && !m.unit && m.targetValue === null && m.actualValue === null;

  if (Array.isArray(item.metrics)) {
    return item.metrics
      .map((m) => toMetric(m?.name, m?.unit, m?.targetValue, m?.actualValue, m?.id))
      .filter((m) => !isEmpty(m));
  }
  const legacy = toMetric(item.metricName, item.metricUnit, item.targetValue, item.actualValue);
  return isEmpty(legacy) ? [] : [legacy];
}

export function normalizeItem(item: ItemInput, customerIds?: Set<string>): Item {
  const execStatus = isExecStatus(item.execStatus) ? item.execStatus : "not_started";
  const resultStatus = isResultStatus(item.resultStatus) ? item.resultStatus : "not_collected";
  const reportStatus = isReportStatus(item.reportStatus) ? item.reportStatus : "not_sent";
  const renewalStatus: RenewalStatus =
    item.renewalStatus === "renewed" || item.renewalStatus === "lost" ? item.renewalStatus : "pending";
  const channel = isChannel(item.channel) ? item.channel : "other";
  const priority = isPriority(item.priority) ? item.priority : "medium";
  const isoDate = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "");
  const rawCustomerId = String(item.customerId || "");
  const metrics = resolveItemMetrics(item);
  const head = metrics[0];

  return {
    id: safeId(item.id, "item"),
    customerId: rawCustomerId && customerIds?.has(rawCustomerId) ? rawCustomerId : "",
    qtNo: String(item.qtNo || "").trim(),
    invNo: String(item.invNo || "").trim(),
    channel,
    itemType: String(item.itemType || "(ไม่ระบุรายการ)").trim(),
    detail: String(item.detail || ""),
    price: normalizePrice(item.price),
    execStatus,
    resultStatus,
    reportStatus,
    renewalStatus,
    target: String(item.target || ""),
    actual: String(item.actual || ""),
    metrics,
    // Scalar mirror of metrics[0] for backward-compat (DB columns / legacy readers).
    metricName: head?.name ?? "",
    metricUnit: head?.unit ?? "",
    targetValue: head?.targetValue ?? null,
    actualValue: head?.actualValue ?? null,
    reportSentDate: isoDate(item.reportSentDate),
    link: safeUrl(item.link),
    rating: clampInt(item.rating, 0, 5),
    deadline: isoDate(item.deadline),
    publishDate: isoDate(item.publishDate),
    finishedDate: isoDate(item.finishedDate),
    notes: String(item.notes || ""),
    followUpDate: isoDate(item.followUpDate),
    followUpNote: String(item.followUpNote || ""),
    priority,
    progress:
      item.progress === undefined || item.progress === null || item.progress === ""
        ? execToProgress(execStatus)
        : clampInt(item.progress, 0, 100),
    checklist: Array.isArray(item.checklist)
      ? item.checklist.map((entry) => ({
          id: safeId(entry.id, "ck"),
          text: String(entry.text || ""),
          done: Boolean(entry.done),
          assignee: String(entry.assignee || "").trim(),
        }))
      : [],
    activity: Array.isArray(item.activity)
      ? item.activity
          .map((entry) => ({
            ts: entry.ts || nowISO(),
            text: String(entry.text || ""),
          }))
          // activity is appended chronologically — keep only the most recent
          // MAX_ACTIVITY entries so the log doesn't grow the storage blob forever.
          .slice(-MAX_ACTIVITY)
      : [],
    createdAt: item.createdAt || nowISO(),
    updatedAt: item.updatedAt || nowISO(),
  };
}

export function normalizeStore(value: Partial<Store>): Store {
  const store = createEmptyStore();
  store.customers = (value.customers || []).map((customer, index) =>
    normalizeCustomer({ ...customer, color: customer.color || CUSTOMER_COLORS[index % CUSTOMER_COLORS.length] }),
  );

  const seenCustomerIds = new Set<string>();
  store.customers.forEach((customer) => {
    while (seenCustomerIds.has(customer.id)) customer.id = uid("cus");
    seenCustomerIds.add(customer.id);
  });

  const customerIds = new Set(store.customers.map((customer) => customer.id));
  store.items = (value.items || []).map((item) => normalizeItem(item, customerIds));

  const seenItemIds = new Set<string>();
  store.items.forEach((item) => {
    while (seenItemIds.has(item.id)) item.id = uid("item");
    seenItemIds.add(item.id);
  });

  store.members = [...new Set((value.members || []).map((member) => String(member)).filter(Boolean))];
  store.customers.forEach((customer) => {
    if (customer.salesOwner && !store.members.includes(customer.salesOwner)) {
      store.members.push(customer.salesOwner);
    }
  });
  store.settings = { currentUser: String(value.settings?.currentUser || "") };
  return store;
}

function normalizePrice(value: unknown) {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isExecStatus(value: unknown): value is ExecStatus {
  return typeof value === "string" && value in EXEC_MAP;
}

function isResultStatus(value: unknown): value is Item["resultStatus"] {
  return typeof value === "string" && value in RESULT_MAP;
}

function isReportStatus(value: unknown): value is Item["reportStatus"] {
  return typeof value === "string" && value in REPORT_MAP;
}

function isChannel(value: unknown): value is ChannelKey {
  return typeof value === "string" && value in CHANNEL_MAP;
}

function isPriority(value: unknown): value is PriorityKey {
  return typeof value === "string" && value in PRIORITY_MAP;
}

const INTERACTION_TYPES = ["call", "meeting", "line", "email", "note"] as const;

function isInteractionType(value: unknown): value is InteractionType {
  return typeof value === "string" && (INTERACTION_TYPES as readonly string[]).includes(value);
}
