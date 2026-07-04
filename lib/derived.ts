import {
  CHANNEL,
  CHANNEL_MAP,
  EXEC_MAP,
  EXEC_STATUS,
  RESULT_STATUS,
  STATUS_DIMS,
  THAI_MONTHS_FULL,
} from "./constants";
import type { Customer, Filters, Item, StatusDimKey } from "./types";

export function money(value: number | null | undefined) {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export function itemName(item: Item) {
  return item.itemType || "(ไม่ระบุรายการ)";
}

// Click-to-contact deep links (#contact-actions) — pure, side-effect-free so
// components can call them straight from JSX. Each returns null for empty
// input so callers can omit the link entirely (no empty `tel:`/`mailto:`/LINE
// anchors ever render).
export function telHref(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

export function mailtoHref(email: string): string | null {
  const trimmed = email.trim();
  return trimmed ? `mailto:${trimmed}` : null;
}

// Best-effort LINE "add by ID" deep link — LINE does not publish an official
// contract for this, so it may not resolve for every id; callers should keep
// showing the raw lineId text alongside the link, not rely on it alone.
export function lineHref(lineId: string): string | null {
  const trimmed = lineId.trim();
  if (!trimmed) return null;
  return `https://line.me/R/ti/p/~${encodeURIComponent(trimmed.replace(/^@/, "@"))}`;
}

export interface SalesSummaryRow {
  label: string;
  count: number;
  revenue: number;
}

function itemRevenue(item: Item) {
  return item.price || 0;
}

function sortSalesRowsByCount(rows: SalesSummaryRow[]) {
  return rows.sort(
    (a, b) =>
      b.count - a.count ||
      b.revenue - a.revenue ||
      a.label.localeCompare(b.label, "th"),
  );
}

function salesRowsFrom(items: Item[], labelForItem: (item: Item) => string) {
  const groups = new Map<string, SalesSummaryRow>();

  items.forEach((item) => {
    const label = labelForItem(item);
    const current = groups.get(label) || { label, count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += itemRevenue(item);
    groups.set(label, current);
  });

  return sortSalesRowsByCount([...groups.values()]);
}

function publishMonthKey(value: string) {
  const key = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : "";
}

export function prevMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return "";

  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Year-over-year counterpart to prevMonthKey — same month, one year earlier
// (e.g. "2026-06" -> "2025-06"). Mirrors prevMonthKey's guard/format exactly so
// callers can swap one for the other without touching anything else.
export function prevYearMonthKey(monthKey: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!match) return "";

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return "";

  return `${year - 1}-${String(month).padStart(2, "0")}`;
}

export function revenueMonthOverMonth(
  nonMonthScopedItems: Item[],
  activeMonthKey: string,
  previousKey?: string,
): { current: number; previous: number; deltaPct: number | null } {
  const previousMonthKey = previousKey ?? prevMonthKey(activeMonthKey);
  let current = 0;
  let previous = 0;

  nonMonthScopedItems.forEach((item) => {
    const month = publishMonthKey(item.publishDate);
    if (month === activeMonthKey) current += itemRevenue(item);
    if (month === previousMonthKey) previous += itemRevenue(item);
  });

  return {
    current,
    previous,
    deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

export interface KpiDelta {
  current: number;
  previous: number;
  delta: number;
  hasPrevious: boolean;
}

export interface KpiMoM {
  totalItems: KpiDelta;
  totalCustomers: KpiDelta;
  achievedPct: KpiDelta;
  reportSentPct: KpiDelta;
  avgRating: KpiDelta;
}

// Month-over-month deltas for the 5 KPI tiles (#13) — revenue already has
// revenueMonthOverMonth; this covers the rest so leadership can tell whether
// execution is improving, not just the current month's snapshot. `items` must
// be the filter-scoped, ALL-MONTHS list (bucketing by publishDate happens
// here); achievedPct/reportSentPct deltas are percentage POINTS (already
// integers on dashboardStats, so plain subtraction is correct), totalItems/
// totalCustomers are count deltas, avgRating is a numeric delta rounded to 1
// decimal to avoid float noise from the two toFixed(1) strings.
// hasPrevious is false when the previous month had no activity at all, so the
// UI can hide a meaningless delta rather than show a fake -100%/+N.
// `previousKey` is optional — omit it for the default MoM comparison
// (prevMonthKey(monthKey)); pass prevYearMonthKey(monthKey) (or any other
// month key) to compare against a different basis, e.g. YoY.
export function kpiMonthOverMonth(
  items: Item[],
  customers: Customer[],
  monthKey: string,
  previousKey?: string,
): KpiMoM {
  const previousMonthKey = previousKey ?? prevMonthKey(monthKey);
  const currentItems = items.filter((item) => publishMonthKey(item.publishDate) === monthKey);
  const previousItems = items.filter((item) => publishMonthKey(item.publishDate) === previousMonthKey);

  const currentStats = dashboardStats(currentItems, customers);
  const previousStats = dashboardStats(previousItems, customers);
  const hasPrevious = previousItems.length > 0;

  const delta = (current: number, previous: number): KpiDelta => ({
    current,
    previous,
    delta: current - previous,
    hasPrevious,
  });

  const currentAvgRating = Number(currentStats.avgRating);
  const previousAvgRating = Number(previousStats.avgRating);

  return {
    totalItems: delta(currentStats.totalItems, previousStats.totalItems),
    totalCustomers: delta(currentStats.totalCustomers, previousStats.totalCustomers),
    achievedPct: delta(currentStats.achievedPct, previousStats.achievedPct),
    reportSentPct: delta(currentStats.reportSentPct, previousStats.reportSentPct),
    avgRating: {
      current: currentAvgRating,
      previous: previousAvgRating,
      delta: Math.round((currentAvgRating - previousAvgRating) * 10) / 10,
      hasPrevious,
    },
  };
}

function formatThaiBuddhistMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex >= THAI_MONTHS_FULL.length) return month;
  return `${THAI_MONTHS_FULL[monthIndex]} ${year + 543}`;
}

export function salesByItemType(items: Item[]) {
  return salesRowsFrom(items, (item) => item.itemType.trim() || "(ไม่ระบุรายการ)");
}

export function salesByCustomer(items: Item[], customers: Customer[]) {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return salesRowsFrom(items, (item) => {
    const customer = customersById.get(item.customerId);
    return customer?.name.trim() || "ไม่ระบุลูกค้า";
  });
}

export function salesByChannel(items: Item[]) {
  return salesRowsFrom(items, (item) => CHANNEL_MAP[item.channel]?.label || CHANNEL_MAP.other.label);
}

export function salesByMonth(items: Item[]) {
  const groups = new Map<string, SalesSummaryRow>();

  items.forEach((item) => {
    const month = publishMonthKey(item.publishDate);
    if (!month) return;
    const current = groups.get(month) || {
      label: formatThaiBuddhistMonth(month),
      count: 0,
      revenue: 0,
    };
    current.count += 1;
    current.revenue += itemRevenue(item);
    groups.set(month, current);
  });

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, row]) => row);
}

export function salesBySalesOwner(items: Item[], customers: Customer[]) {
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  return salesRowsFrom(items, (item) => {
    const customer = customersById.get(item.customerId);
    return customer?.salesOwner.trim() || "ไม่ระบุเจ้าของงานขาย";
  });
}

export function groupItemsByQt(items: Item[]) {
  const groups = new Map<string, Item[]>();
  items.forEach((item) => {
    const key = item.qtNo || "(ไม่มี QT)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return [...groups.entries()];
}

export function groupItemsByCustomer(items: Item[]) {
  const groups = new Map<string, Item[]>();
  items.forEach((item) => {
    const key = item.customerId || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return [...groups.entries()];
}

// "Group by ประเภทงาน" view (Items list) — the itemType counterpart to
// groupItemsByCustomer, for reps who think in content-format buckets rather
// than by customer. Sorted by count desc (busiest itemType first), ties
// broken alphabetically (Thai collation) for a stable order — mirrors
// salesRowsFrom's ranking so the two "most-used itemType" views agree.
export function groupItemsByItemType(items: Item[]): [string, Item[]][] {
  const groups = new Map<string, Item[]>();
  items.forEach((item) => {
    const key = item.itemType.trim() || "(ไม่ระบุรายการ)";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });
  return [...groups.entries()].sort(
    ([labelA, itemsA], [labelB, itemsB]) =>
      itemsB.length - itemsA.length || labelA.localeCompare(labelB, "th"),
  );
}

export function customerRevenue(items: Item[], id: string) {
  return items.filter((item) => item.customerId === id).reduce((sum, item) => sum + (item.price || 0), 0);
}

export function customerProgress(items: Item[], id: string) {
  const ownItems = items.filter((item) => item.customerId === id);
  if (!ownItems.length) return 0;
  return Math.round(ownItems.reduce((sum, item) => sum + (item.progress || 0), 0) / ownItems.length);
}

export function provinceLinkMismatch(
  item: Pick<Item, "link">,
  customer: Pick<Customer, "province"> | null | undefined,
) {
  if (customer?.province.trim() !== "ขอนแก่น") return false;
  return /\/(?:udon|ubon)\//i.test(item.link);
}

export function achievedPercent(items: Item[], customerId?: string) {
  const scoped = customerId ? items.filter((item) => item.customerId === customerId) : items;
  if (!scoped.length) return 0;
  return Math.round((scoped.filter((item) => item.resultStatus === "achieved").length / scoped.length) * 100);
}

export interface FilterableState {
  customers: Customer[];
  items: Item[];
  settings: { currentUser: string };
  filters: Filters;
  calDateField: "publishDate" | "deadline" | "finishedDate";
  statusDim: StatusDimKey;
}

export interface ActiveFilterChip {
  key: keyof Filters;
  label: string;
}

export type ActiveFilterState = Pick<FilterableState, "customers" | "settings" | "filters"> & {
  statusDim?: StatusDimKey;
  boardDim?: StatusDimKey;
};

export function activeFilterChips(state: ActiveFilterState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const { filters } = state;
  const customersById = new Map(state.customers.map((customer) => [customer.id, customer]));
  const statusDimKey = state.statusDim || state.boardDim || "exec";
  const statusDim = STATUS_DIMS[statusDimKey] || STATUS_DIMS.exec;

  const q = filters.q.trim();
  if (q) chips.push({ key: "q", label: `ค้นหา: "${q}"` });

  if (filters.customerId) {
    const customer = customersById.get(filters.customerId);
    chips.push({ key: "customerId", label: `ลูกค้า: ${customer?.name.trim() || filters.customerId}` });
  }

  if (filters.channel) {
    const channel = CHANNEL_MAP[filters.channel as keyof typeof CHANNEL_MAP];
    chips.push({ key: "channel", label: `ช่องทาง: ${channel?.label || filters.channel}` });
  }

  if (filters.itemType) chips.push({ key: "itemType", label: `ประเภทงาน: ${filters.itemType}` });

  if (filters.salesOwner) chips.push({ key: "salesOwner", label: `เจ้าของงาน: ${filters.salesOwner}` });
  if (filters.province) chips.push({ key: "province", label: `จังหวัด: ${filters.province}` });

  if (filters.statusKey) {
    const status = statusDim.list.find((candidate) => candidate.key === filters.statusKey);
    chips.push({ key: "statusKey", label: `${statusDim.label}: ${status?.label || filters.statusKey}` });
  }

  if (filters.qtNo) chips.push({ key: "qtNo", label: `QT: ${filters.qtNo}` });
  if (filters.dateFrom) chips.push({ key: "dateFrom", label: `ตั้งแต่: ${filters.dateFrom}` });
  if (filters.dateTo) chips.push({ key: "dateTo", label: `ถึง: ${filters.dateTo}` });

  if (filters.mine) {
    chips.push({ key: "mine", label: `งานของฉัน (${state.settings.currentUser})` });
  }

  if (filters.overdue) chips.push({ key: "overdue", label: "งานค้าง (เกินกำหนด)" });

  return chips;
}

export function hasActiveFilters(state: ActiveFilterState): boolean {
  return activeFilterChips(state).length > 0;
}

export function filteredItems(state: FilterableState) {
  const q = state.filters.q.trim().toLowerCase();
  const dim = STATUS_DIMS[state.statusDim] || STATUS_DIMS.exec;
  const customersById = new Map(state.customers.map((customer) => [customer.id, customer]));

  const list = state.items.filter((item) => {
    const customer = customersById.get(item.customerId);
    if (state.filters.mine && customer?.salesOwner !== state.settings.currentUser) return false;
    if (state.filters.customerId && item.customerId !== state.filters.customerId) return false;
    if (state.filters.qtNo && item.qtNo !== state.filters.qtNo) return false;
    if (state.filters.channel && item.channel !== state.filters.channel) return false;
    if (state.filters.itemType && item.itemType !== state.filters.itemType) return false;
    if (state.filters.salesOwner && customer?.salesOwner !== state.filters.salesOwner) return false;
    if (state.filters.province && customer?.province !== state.filters.province) return false;
    if (state.filters.statusKey && item[dim.field] !== state.filters.statusKey) return false;
    if (state.filters.overdue && !isOverdue(item)) return false;

    const dateValue = item[state.calDateField] || "";
    if (state.filters.dateFrom && (!dateValue || dateValue < state.filters.dateFrom)) return false;
    if (state.filters.dateTo && (!dateValue || dateValue > state.filters.dateTo)) return false;

    if (q) {
      const haystack = [
        item.itemType,
        item.detail,
        item.notes,
        item.target,
        item.actual,
        customer?.name || "",
        item.qtNo,
        item.invNo,
        customer?.province || "",
        customer?.salesOwner || "",
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    const ca = customersById.get(a.customerId);
    const cb = customersById.get(b.customerId);
    return (
      (ca?.name || "").localeCompare(cb?.name || "", "th") ||
      (a.qtNo || "").localeCompare(b.qtNo || "") ||
      (a.publishDate || "9999").localeCompare(b.publishDate || "9999") ||
      itemName(a).localeCompare(itemName(b), "th")
    );
  });

  return list;
}

export function dashboardStats(items: Item[], customers: Customer[]) {
  const totalItems = items.length;
  const totalCustomers = new Set(items.map((item) => item.customerId).filter(Boolean)).size;
  const revenue = items.reduce((sum, item) => sum + (item.price || 0), 0);
  const rated = items.filter((item) => item.rating > 0);
  const ratedCount = rated.length;
  const avgRating = ratedCount
    ? (rated.reduce((sum, item) => sum + item.rating, 0) / ratedCount).toFixed(1)
    : "0.0";
  const achievedPct = totalItems
    ? Math.round((items.filter((item) => item.resultStatus === "achieved").length / totalItems) * 100)
    : 0;
  const reportSentPct = totalItems
    ? Math.round((items.filter((item) => item.reportStatus === "sent").length / totalItems) * 100)
    : 0;
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const sum = (source: Item[]) => source.reduce((acc, item) => acc + (item.price || 0), 0);

  const byOwner = [...new Set(customers.map((customer) => customer.salesOwner || "ไม่ระบุ"))]
    .map((owner) => ({
      owner,
      value: sum(items.filter((item) => (customersById.get(item.customerId)?.salesOwner || "ไม่ระบุ") === owner)),
    }))
    .filter((entry) => entry.value > 0);

  const byChannel = CHANNEL.map((channel) => ({
    channel,
    value: sum(items.filter((item) => item.channel === channel.key)),
  })).filter((entry) => entry.value > 0);

  const monthMap = new Map<string, number>();
  items.forEach((item) => {
    if (!item.publishDate) return;
    const key = item.publishDate.slice(0, 7);
    monthMap.set(key, (monthMap.get(key) || 0) + (item.price || 0));
  });

  const topCustomers = customers
    .map((customer) => ({ customer, value: customerRevenue(items, customer.id) }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  return {
    totalItems,
    totalCustomers,
    revenue,
    avgRating,
    ratedCount,
    achievedPct,
    reportSentPct,
    execCounts: EXEC_STATUS.map((status) => ({
      status,
      value: items.filter((item) => item.execStatus === status.key).length,
    })),
    resultCounts: RESULT_STATUS.map((status) => ({
      status,
      value: items.filter((item) => item.resultStatus === status.key).length,
    })),
    byChannel,
    byOwner,
    byMonth: [...monthMap.entries()].sort().map(([month, value]) => ({ month, value })),
    topCustomers,
    itemsByChannel: CHANNEL.map((channel) => ({
      channel,
      value: items.filter((item) => item.channel === channel.key).length,
    })).filter((entry) => entry.value > 0),
  };
}

export function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = startOfDay(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function isPendingPublish(item: Item) {
  return item.execStatus === "not_started" || item.execStatus === "in_progress";
}

export function isPublishedWork(item: Item) {
  return item.execStatus === "published" || item.execStatus === "done";
}

export function isOverdue(item: Item) {
  if (item.execStatus === "done") return false;
  const today = startOfDay(new Date());

  if (item.deadline) {
    const date = parseDate(item.deadline);
    return Boolean(date && startOfDay(date) < today);
  }

  if (!isPendingPublish(item)) return false;
  const publishDate = parseDate(item.publishDate);
  return Boolean(publishDate && startOfDay(publishDate) < today);
}

export function isDueSoon(item: Item) {
  if (item.execStatus === "done" || isOverdue(item)) return false;
  const dateValue = item.deadline || (isPendingPublish(item) ? item.publishDate : "");
  const date = parseDate(dateValue);
  if (!date) return false;
  const diff = (Number(startOfDay(date)) - Number(startOfDay(new Date()))) / 86400000;
  return diff >= 0 && diff <= 3;
}

// Personal follow-up reminders (#8) — a rep's own next-action date, distinct from
// the machine-derived worklists above. Due or overdue (<= today) surfaces it;
// a finished item's follow-up is moot, mirroring isOverdue's done-exclusion.
// Sorted oldest/most-overdue first.
export function itemsFollowUpDue(items: Item[], today: Date) {
  const day = startOfDay(today);
  return items
    .filter((item) => {
      if (item.execStatus === "done") return false;
      const followUpDate = parseDate(item.followUpDate);
      return Boolean(followUpDate && startOfDay(followUpDate) <= day);
    })
    .sort((a, b) => Number(startOfDay(parseDate(a.followUpDate)!)) - Number(startOfDay(parseDate(b.followUpDate)!)));
}

// App-wide "needs attention today" badge count (nav reminder) — sums the two
// genuinely time-urgent buckets: personal follow-ups due/overdue today
// (itemsFollowUpDue) and overdue publish/deadline work (isOverdue). Deliberately
// a plain sum, not a de-duped union — an item that is BOTH follow-up-due AND
// overdue represents two distinct actions the rep owes today, so it counts
// twice. Reuses the existing helpers verbatim; no new date logic here.
export function attentionDueCount(items: Item[], today: Date): number {
  return itemsFollowUpDue(items, today).length + items.filter(isOverdue).length;
}

export function itemsNotPublished(items: Item[], today: Date) {
  const day = startOfDay(today);
  return items.filter((item) => {
    if (!isPendingPublish(item)) return false;
    const publishDate = parseDate(item.publishDate);
    return Boolean(publishDate && startOfDay(publishDate) < day);
  });
}

export function itemsResultsNotCollected(items: Item[]) {
  return items.filter((item) => isPublishedWork(item) && item.resultStatus === "not_collected");
}

export function itemsReportNotSent(items: Item[]) {
  return items.filter((item) => isPublishedWork(item) && item.reportStatus === "not_sent");
}

export function itemsExpiringSoon(items: Item[], today: Date, days = 30) {
  const from = startOfDay(today);
  const to = addDays(today, days);
  return items.filter((item) => {
    if (item.renewalStatus !== "pending") return false; // already renewed/lost → off the radar
    const finishedDate = parseDate(item.finishedDate);
    if (!finishedDate) return false;
    const day = startOfDay(finishedDate);
    return day >= from && day <= to;
  });
}

export function itemsExpired(items: Item[], today: Date) {
  const day = startOfDay(today);
  return items.filter((item) => {
    if (item.renewalStatus !== "pending") return false; // already renewed/lost → off the radar
    const finishedDate = parseDate(item.finishedDate);
    return Boolean(finishedDate && startOfDay(finishedDate) < day);
  });
}

// Renewal outcomes among ALL campaigns that have reached expiry (regardless of
// current status) — this is the renewal RATE the at-risk radar can't show.
export function renewalOutcomes(items: Item[], today: Date) {
  const day = startOfDay(today);
  const expired = items.filter((item) => {
    const finishedDate = parseDate(item.finishedDate);
    return Boolean(finishedDate && startOfDay(finishedDate) < day);
  });
  const renewed = expired.filter((item) => item.renewalStatus === "renewed").length;
  const lost = expired.filter((item) => item.renewalStatus === "lost").length;
  const decided = renewed + lost;
  return {
    total: expired.length,
    renewed,
    lost,
    pending: expired.length - decided,
    rate: decided ? Math.round((renewed / decided) * 100) : null,
  };
}

export interface RenewalBucket {
  count: number;
  revenue: number;
}

// Renewal / revenue-at-risk pipeline keyed on finishedDate (= campaign expiry).
// The within-N windows are cumulative (within60 includes within30).
export function renewalPipeline(items: Item[], today: Date) {
  const bucket = (list: Item[]): RenewalBucket => ({
    count: list.length,
    revenue: list.reduce((total, item) => total + (item.price || 0), 0),
  });
  return {
    expired: bucket(itemsExpired(items, today)),
    within30: bucket(itemsExpiringSoon(items, today, 30)),
    within60: bucket(itemsExpiringSoon(items, today, 60)),
    within90: bucket(itemsExpiringSoon(items, today, 90)),
  };
}

export interface RevenueBreakdown {
  total: number;
  invoiced: number;
  quoted: number;
  netOfVat: number;
  vat: number;
}

// Split revenue by recognition stage. Price is VAT-inclusive (sheet header
// "ราคา VAT7%"); a QT counts as invoiced if ANY of its lines carries an INV no.
export function revenueBreakdown(items: Item[], vatRate = 0.07): RevenueBreakdown {
  const byQt = new Map<string, { revenue: number; invoiced: boolean }>();
  for (const item of items) {
    const key = item.qtNo?.trim() || `__item_${item.id}`;
    const entry = byQt.get(key) || { revenue: 0, invoiced: false };
    entry.revenue += item.price || 0;
    if (item.invNo?.trim()) entry.invoiced = true;
    byQt.set(key, entry);
  }
  let total = 0;
  let invoiced = 0;
  for (const entry of byQt.values()) {
    total += entry.revenue;
    if (entry.invoiced) invoiced += entry.revenue;
  }
  const netOfVat = Math.round(total / (1 + vatRate));
  return { total, invoiced, quoted: total - invoiced, netOfVat, vat: total - netOfVat };
}

export interface OwnerConcentration {
  topOwner: string;
  topCount: number;
  topRevenue: number;
  topPct: number;
  ownerCount: number;
  total: number;
}

// Surface key-person / revenue concentration risk (e.g. one owner holds most work).
export function ownerConcentration(items: Item[], customers: Customer[]): OwnerConcentration {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const byOwner = new Map<string, { count: number; revenue: number }>();
  for (const item of items) {
    const owner = customerById.get(item.customerId)?.salesOwner?.trim() || "ไม่ระบุ";
    const entry = byOwner.get(owner) || { count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += item.price || 0;
    byOwner.set(owner, entry);
  }
  let top = { owner: "", count: 0, revenue: 0 };
  for (const [owner, entry] of byOwner) {
    if (entry.count > top.count) top = { owner, count: entry.count, revenue: entry.revenue };
  }
  return {
    topOwner: top.owner,
    topCount: top.count,
    topRevenue: top.revenue,
    topPct: items.length ? Math.round((top.count / items.length) * 100) : 0,
    ownerCount: byOwner.size,
    total: items.length,
  };
}

export interface CustomerConcentration {
  topName: string;
  topRevenue: number;
  topPct: number;
  top3Pct: number;
  customerCount: number;
  total: number;
}

// Client-side analog of ownerConcentration — Pareto/dependency risk on CUSTOMERS
// (share-of-total revenue), not internal owners: "top 3 customers = X% of
// revenue" is the client-dependency warning that topCustomers (ranked, but never
// expressed as a %) doesn't surface.
export function customerConcentration(items: Item[], customers: Customer[]): CustomerConcentration {
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const byCustomer = new Map<string, number>();
  for (const item of items) {
    byCustomer.set(item.customerId, (byCustomer.get(item.customerId) || 0) + (item.price || 0));
  }

  const rows = [...byCustomer.entries()]
    .map(([customerId, revenue]) => ({
      name: customerNameById.get(customerId)?.trim() || "ไม่ระบุ",
      revenue,
    }))
    .filter((row) => row.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  const total = rows.reduce((sum, row) => sum + row.revenue, 0);
  const top = rows[0];
  const top3Revenue = rows.slice(0, 3).reduce((sum, row) => sum + row.revenue, 0);

  return {
    topName: top?.name || "ไม่ระบุ",
    topRevenue: top?.revenue || 0,
    topPct: total ? Math.round((top!.revenue / total) * 100) : 0,
    top3Pct: total ? Math.round((top3Revenue / total) * 100) : 0,
    customerCount: rows.length,
    total,
  };
}

// Coverage of a date field — how many items actually carry it (for reconcile notes).
export function dateFieldCoverage(items: Item[], field: "publishDate" | "finishedDate" | "deadline") {
  const withDate = items.filter((item) => /^\d{4}-\d{2}/.test(item[field] || "")).length;
  return { withDate, total: items.length };
}

export interface ChannelPerf {
  key: string;
  label: string;
  color: string;
  count: number;
  achievedPct: number;
  reportSentPct: number;
  avgRating: number;
  ratedCount: number;
}

// Performance (not just volume) per channel: achieved% / report-sent% / avg⭐.
export function channelPerformance(items: Item[]): ChannelPerf[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.channel || "other";
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  const rows: ChannelPerf[] = [];
  for (const [key, list] of groups) {
    const meta = CHANNEL_MAP[key as keyof typeof CHANNEL_MAP] || CHANNEL_MAP.other;
    const rated = list.filter((item) => item.rating > 0);
    rows.push({
      key,
      label: meta.label,
      color: meta.color,
      count: list.length,
      achievedPct: Math.round((list.filter((item) => item.resultStatus === "achieved").length / list.length) * 100),
      reportSentPct: Math.round((list.filter((item) => item.reportStatus === "sent").length / list.length) * 100),
      avgRating: rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : 0,
      ratedCount: rated.length,
    });
  }
  return rows.sort((a, b) => b.count - a.count);
}

export interface OwnerPerf {
  owner: string;
  count: number;
  revenue: number;
  achievedPct: number;
  reportSentPct: number;
  avgRating: number;
  ratedCount: number;
  renewedCount: number;
  lostCount: number;
  renewalRate: number | null;
}

// Per-sales-owner performance — not just revenue volume: achieved% / report-sent%
// / avg⭐ / renewal outcome, so a CEO can see who is winning vs slipping.
// renewalRate = renewed / (renewed + lost) among the owner's DECIDED renewals
// (null when none decided yet — honest "no signal" rather than a false 0/100).
export function ownerPerformance(items: Item[], customers: Customer[]): OwnerPerf[] {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const owner = customerById.get(item.customerId)?.salesOwner?.trim() || "ไม่ระบุ";
    const list = groups.get(owner) || [];
    list.push(item);
    groups.set(owner, list);
  }
  const rows: OwnerPerf[] = [];
  for (const [owner, list] of groups) {
    const rated = list.filter((item) => item.rating > 0);
    const renewedCount = list.filter((item) => item.renewalStatus === "renewed").length;
    const lostCount = list.filter((item) => item.renewalStatus === "lost").length;
    const decided = renewedCount + lostCount;
    rows.push({
      owner,
      count: list.length,
      revenue: list.reduce((total, item) => total + (item.price || 0), 0),
      achievedPct: Math.round((list.filter((item) => item.resultStatus === "achieved").length / list.length) * 100),
      reportSentPct: Math.round((list.filter((item) => item.reportStatus === "sent").length / list.length) * 100),
      avgRating: rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : 0,
      ratedCount: rated.length,
      renewedCount,
      lostCount,
      renewalRate: decided ? Math.round((renewedCount / decided) * 100) : null,
    });
  }
  return rows.sort(
    (a, b) => b.count - a.count || b.revenue - a.revenue || a.owner.localeCompare(b.owner, "th"),
  );
}

export interface ItemTypePerf {
  itemType: string;
  count: number;
  achievedPct: number;
  reportSentPct: number;
  avgRating: number;
  ratedCount: number;
}

// Per content-format (itemType) performance — which formats actually hit their
// result / earn ratings, not just volume+revenue (that is salesByItemType).
// Mirrors channelPerformance() so the report reads consistently.
export function itemTypePerformance(items: Item[]): ItemTypePerf[] {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const key = item.itemType.trim() || "(ไม่ระบุรายการ)";
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  const rows: ItemTypePerf[] = [];
  for (const [itemType, list] of groups) {
    const rated = list.filter((item) => item.rating > 0);
    rows.push({
      itemType,
      count: list.length,
      achievedPct: Math.round((list.filter((item) => item.resultStatus === "achieved").length / list.length) * 100),
      reportSentPct: Math.round((list.filter((item) => item.reportStatus === "sent").length / list.length) * 100),
      avgRating: rated.length ? rated.reduce((sum, item) => sum + item.rating, 0) / rated.length : 0,
      ratedCount: rated.length,
    });
  }
  return rows.sort((a, b) => b.count - a.count || a.itemType.localeCompare(b.itemType, "th"));
}

export interface AttainmentGroup {
  metric: string;
  unit: string;
  label: string;
  count: number;
  totalTarget: number;
  totalActual: number;
  attainmentPct: number | null;
}

export interface AttainmentSummary {
  groups: AttainmentGroup[];
  measured: number;
  total: number;
}

// Aggregate numeric goal attainment (targetValue vs actualValue) so "did it work"
// becomes a magnitude, not just the binary resultStatus. Grouped by metric+unit —
// NEVER summed across units (reach-in-times and reach-in-% are not addable). Only
// items carrying a metric name AND both numbers count; `measured/total` reports
// coverage so sparse data reads as "add numbers", not a false zero.
export function attainmentSummary(items: Item[]): AttainmentSummary {
  const groups = new Map<string, AttainmentGroup>();
  let measured = 0;

  for (const item of items) {
    const metric = item.metricName.trim();
    if (!metric || item.targetValue == null || item.actualValue == null) continue;
    measured += 1;

    const unit = item.metricUnit.trim();
    const key = `${metric}||${unit}`;
    const group = groups.get(key) || {
      metric,
      unit,
      label: unit ? `${metric} (${unit})` : metric,
      count: 0,
      totalTarget: 0,
      totalActual: 0,
      attainmentPct: null,
    };
    group.count += 1;
    group.totalTarget += item.targetValue;
    group.totalActual += item.actualValue;
    groups.set(key, group);
  }

  const result = [...groups.values()]
    .map((group) => ({
      ...group,
      attainmentPct:
        group.totalTarget > 0 ? Math.round((group.totalActual / group.totalTarget) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "th"));

  return { groups: result, measured, total: items.length };
}

export interface CustomerHealth {
  customerId: string;
  name: string;
  revenue: number;
  achievedPct: number | null;
  reportSentPct: number | null;
  avgRating: number | null;
  ratedCount: number;
  renewedCount: number;
  lostCount: number;
  pendingRenewalCount: number;
  expiredPendingCount: number;
  revenueAtRisk: number;
  tier: "at-risk" | "watch" | "healthy";
  reason: string;
}

// Tier thresholds for customerHealth — product judgment calls, not derived from data.
const ACHIEVED_FLOOR = 40; // achievedPct below this => at-risk (severely underperforming)
const ACHIEVED_WATCH = 60; // achievedPct below this (but >= floor) => watch (borderline)
const REPORT_SENT_WATCH = 50; // reportSentPct below this => watch (comms slipping)
const RENEWAL_WATCH_DAYS = 30; // pending renewal expiring within this many days => watch
const RENEWAL_RISK_DAYS = 90; // pending renewal within this window counts as revenue at risk

// Per-customer account-health / churn-risk scorecard — the retention signal the
// existing global (renewalOutcomes) and per-owner (ownerPerformance) rollups can't
// show: WHICH customer is slipping and WHY. Null-coverage mirrors attainmentSummary/
// ownerPerformance.renewalRate — no measured data reports null, never a false 0/100.
export function customerHealth(items: Item[], customers: Customer[], today: Date): CustomerHealth[] {
  const itemsByCustomer = new Map<string, Item[]>();
  for (const item of items) {
    const list = itemsByCustomer.get(item.customerId) || [];
    list.push(item);
    itemsByCustomer.set(item.customerId, list);
  }

  const expiredItems = itemsExpired(items, today);
  const expiredIds = new Set(expiredItems.map((item) => item.id));
  const expiringWithin30Ids = new Set(
    itemsExpiringSoon(items, today, RENEWAL_WATCH_DAYS).map((item) => item.id),
  );
  const expiringWithin90 = itemsExpiringSoon(items, today, RENEWAL_RISK_DAYS);
  const atRiskRevenueIds = new Set([...expiredItems, ...expiringWithin90].map((item) => item.id));

  return customers.map((customer) => {
    const ownItems = itemsByCustomer.get(customer.id) || [];
    const revenue = customerRevenue(items, customer.id);

    const achievedPct = ownItems.length
      ? Math.round(
          (ownItems.filter((item) => item.resultStatus === "achieved").length / ownItems.length) * 100,
        )
      : null;
    const reportSentPct = ownItems.length
      ? Math.round(
          (ownItems.filter((item) => item.reportStatus === "sent").length / ownItems.length) * 100,
        )
      : null;

    const rated = ownItems.filter((item) => item.rating > 0);
    const ratedCount = rated.length;
    const avgRating = ratedCount ? rated.reduce((sum, item) => sum + item.rating, 0) / ratedCount : null;

    const renewedCount = ownItems.filter((item) => item.renewalStatus === "renewed").length;
    const lostCount = ownItems.filter((item) => item.renewalStatus === "lost").length;
    const pendingRenewalCount = ownItems.filter((item) => item.renewalStatus === "pending").length;

    const expiredPendingCount = ownItems.filter((item) => expiredIds.has(item.id)).length;
    const revenueAtRisk = ownItems
      .filter((item) => atRiskRevenueIds.has(item.id))
      .reduce((sum, item) => sum + (item.price || 0), 0);
    const hasExpiringWithin30 = ownItems.some((item) => expiringWithin30Ids.has(item.id));

    let tier: CustomerHealth["tier"];
    let reason: string;

    if (lostCount > 0) {
      tier = "at-risk";
      reason = "เสียลูกค้า";
    } else if (expiredPendingCount > 0) {
      tier = "at-risk";
      reason = `หมดอายุรอต่อ ${expiredPendingCount} งาน`;
    } else if (achievedPct !== null && achievedPct < ACHIEVED_FLOOR) {
      tier = "at-risk";
      reason = `บรรลุผลต่ำ (${achievedPct}%)`;
    } else if (hasExpiringWithin30) {
      tier = "watch";
      reason = "ใกล้หมดอายุ";
    } else if (achievedPct !== null && achievedPct < ACHIEVED_WATCH) {
      tier = "watch";
      reason = "ผลลัพธ์ปานกลาง";
    } else if (reportSentPct !== null && reportSentPct < REPORT_SENT_WATCH) {
      tier = "watch";
      reason = "ค้างส่งรีพอร์ต";
    } else {
      tier = "healthy";
      reason = "แข็งแรง";
    }

    return {
      customerId: customer.id,
      name: customer.name,
      revenue,
      achievedPct,
      reportSentPct,
      avgRating,
      ratedCount,
      renewedCount,
      lostCount,
      pendingRenewalCount,
      expiredPendingCount,
      revenueAtRisk,
      tier,
      reason,
    };
  });
}

export interface RevenueForecast {
  committed: number;
  atRiskRevenue: number;
  renewalRate: number | null;
  expectedRenewal: number | null;
  forecastTotal: number | null;
}

// Forward-looking revenue forecast (#2) — every other money figure in the report
// is backward-looking (revenueBreakdown = booked) or risk-facing (renewalPipeline/
// renewalOutcomes = pending exposure); this is the only one that PROJECTS. It
// reuses those helpers verbatim, no new revenue math or date logic: committed =
// unbilled quoted pipeline (revenueBreakdown.quoted); atRiskRevenue = near-term
// pending-renewal revenue up for renewal (renewalPipeline.expired + within90,
// already cumulative-future); expectedRenewal probability-weights atRiskRevenue
// by the historical renewal RATE (renewalOutcomes.rate). Null-honesty mirrors
// attainmentSummary/ownerPerformance.renewalRate/customerHealth: no decided
// renewals yet => renewalRate/expectedRenewal/forecastTotal are null, never a
// fake 0, while committed still reports a real number.
export function revenueForecast(items: Item[], today: Date): RevenueForecast {
  const committed = revenueBreakdown(items).quoted;
  const pipeline = renewalPipeline(items, today);
  const atRiskRevenue = pipeline.expired.revenue + pipeline.within90.revenue;
  const renewalRate = renewalOutcomes(items, today).rate;
  const expectedRenewal = renewalRate === null ? null : Math.round((atRiskRevenue * renewalRate) / 100);
  const forecastTotal = expectedRenewal === null ? null : committed + expectedRenewal;
  return { committed, atRiskRevenue, renewalRate, expectedRenewal, forecastTotal };
}

// SLA target for report turnaround (finishedDate -> reportSentDate) — product judgment, not derived from data.
const REPORT_SLA_DAYS = 7;

export interface ReportTurnaround {
  measured: number;
  total: number;
  avgDays: number | null;
  medianDays: number | null;
  withinSlaPct: number | null;
  breachingCount: number;
  slaDays: number;
}

// Report turnaround (#4) — the only reporting metric today is the binary
// reportSentPct; this measures HOW LATE reports actually go out relative to
// campaign end (finishedDate, fallback publishDate), the client-facing SLA
// signal ("we deliver the report within N days"). Only items marked sent with
// both a base date and a reportSentDate count; reports dated before the base
// date (bad data) are excluded, not counted as negative turnaround.
// Null-honesty mirrors attainmentSummary/customerHealth: no measured data =>
// null, never a fake 0.
export function reportTurnaround(items: Item[]): ReportTurnaround {
  const daysList: number[] = [];

  for (const item of items) {
    if (item.reportStatus !== "sent") continue;
    const sentDate = parseDate(item.reportSentDate);
    if (!sentDate) continue;
    const baseDate = parseDate(item.finishedDate) ?? parseDate(item.publishDate);
    if (!baseDate) continue;

    const days = Math.round((Number(startOfDay(sentDate)) - Number(startOfDay(baseDate))) / 86400000);
    if (days < 0) continue;
    daysList.push(days);
  }

  const measured = daysList.length;
  if (measured === 0) {
    return {
      measured: 0,
      total: items.length,
      avgDays: null,
      medianDays: null,
      withinSlaPct: null,
      breachingCount: 0,
      slaDays: REPORT_SLA_DAYS,
    };
  }

  const sorted = [...daysList].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const medianDays =
    sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
  const avgDays = Math.round(daysList.reduce((sum, days) => sum + days, 0) / measured);
  const withinSlaCount = daysList.filter((days) => days <= REPORT_SLA_DAYS).length;
  const breachingCount = measured - withinSlaCount;

  return {
    measured,
    total: items.length,
    avgDays,
    medianDays,
    withinSlaPct: Math.round((withinSlaCount / measured) * 100),
    breachingCount,
    slaDays: REPORT_SLA_DAYS,
  };
}

export interface PriceIssueRow {
  item: Item;
  customerName: string;
}

export interface PriceIntegrityIssues {
  negative: PriceIssueRow[];
  unpricedDelivered: PriceIssueRow[];
  count: number;
}

function sortPriceIssueRows(rows: PriceIssueRow[]) {
  return rows.sort(
    (a, b) =>
      a.customerName.localeCompare(b.customerName, "th") ||
      itemName(a.item).localeCompare(itemName(b.item), "th"),
  );
}

// Price data-integrity worklist for finance — deliberately narrow to avoid the
// false positive that pricing is at the QUOTATION level: many item lines
// legitimately have price === null because another line of the same qtNo
// carries the price. Only two genuinely-wrong states get flagged:
// (1) negative price (always bad data), and (2) delivered (published/done)
// work whose WHOLE quotation has no priced line at all (a quotation with any
// positive-priced line is not flagged — a net-zero SUM would wrongly clear a
// group that has both a +priced and a -priced line). negative takes
// precedence so an item is never double-counted. Grouped by
// `${customerId}||${qtNo}` (mirrors unbilledQuotations) so two different
// customers who happen to reuse the same qtNo never merge into one group;
// items with an empty qtNo each get their own group key so they never
// cross-merge with each other either.
export function priceIntegrityIssues(items: Item[], customers: Customer[]): PriceIntegrityIssues {
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const nameFor = (item: Item) => customerNameById.get(item.customerId)?.trim() || "ไม่ระบุลูกค้า";

  const negativeIds = new Set<string>();
  const negative: PriceIssueRow[] = [];
  items.forEach((item) => {
    if (item.price !== null && item.price < 0) {
      negativeIds.add(item.id);
      negative.push({ item, customerName: nameFor(item) });
    }
  });

  const groups = new Map<string, Item[]>();
  items.forEach((item) => {
    const key = `${item.customerId}||${item.qtNo || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  });

  const unpricedDelivered: PriceIssueRow[] = [];
  groups.forEach((group) => {
    const hasPricedLine = group.some((item) => (item.price || 0) > 0);
    if (hasPricedLine) return;
    group.forEach((item) => {
      if (negativeIds.has(item.id)) return;
      if (item.execStatus === "published" || item.execStatus === "done") {
        unpricedDelivered.push({ item, customerName: nameFor(item) });
      }
    });
  });

  sortPriceIssueRows(negative);
  sortPriceIssueRows(unpricedDelivered);

  return { negative, unpricedDelivered, count: negative.length + unpricedDelivered.length };
}

export interface UnbilledQuotation {
  qtNo: string;
  customerId: string;
  customerName: string;
  revenue: number;
  itemCount: number;
  billedRevenue: number;
  unbilledRevenue: number;
  status: "unbilled" | "partial";
  ageDays: number | null;
}

export interface UnbilledSummary {
  rows: UnbilledQuotation[];
  totalUnbilled: number;
  count: number;
}

// Unbilled-quotation worklist (#6) — revenueBreakdown marks a whole QT invoiced
// if ANY of its lines carries an INV no, so a partially-billed (or fully
// unbilled) quotation is invisible to finance. This drills down to QT level,
// grouped per customer (so the same qtNo reused under a different customer
// doesn't merge), and only surfaces groups that still have real money left to
// bill. ageDays is the billing LAG — days since the work was actually
// delivered (latest finishedDate, else publishDate, across the QT's lines) to
// today — so an old unbilled QT is distinguishable from a fresh one.
export function unbilledQuotations(items: Item[], customers: Customer[], today: Date): UnbilledSummary {
  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const day = startOfDay(today);

  const groups = new Map<string, { qtNo: string; customerId: string; items: Item[] }>();
  for (const item of items) {
    const qtNo = item.qtNo.trim();
    if (!qtNo) continue; // a quotation must have a number to be a billable QO
    const key = `${item.customerId}||${qtNo}`;
    const group = groups.get(key) || { qtNo, customerId: item.customerId, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  const rows: UnbilledQuotation[] = [];
  for (const { qtNo, customerId, items: group } of groups.values()) {
    const revenue = group.reduce((sum, item) => sum + (item.price || 0), 0);
    const billedRevenue = group.reduce(
      (sum, item) => sum + (item.invNo.trim() ? item.price || 0 : 0),
      0,
    );
    const unbilledRevenue = revenue - billedRevenue;
    if (revenue <= 0 || unbilledRevenue <= 0) continue; // no real money left to bill

    let latest: Date | null = null;
    for (const item of group) {
      const date = parseDate(item.finishedDate) || parseDate(item.publishDate);
      if (date && (!latest || date > latest)) latest = date;
    }
    const ageDays = latest
      ? Math.max(0, Math.round((Number(day) - Number(startOfDay(latest))) / 86400000))
      : null;

    rows.push({
      qtNo,
      customerId,
      customerName: customerNameById.get(customerId)?.trim() || "ไม่ระบุลูกค้า",
      revenue,
      itemCount: group.length,
      billedRevenue,
      unbilledRevenue,
      status: billedRevenue === 0 ? "unbilled" : "partial",
      ageDays,
    });
  }

  rows.sort((a, b) => {
    if (b.unbilledRevenue !== a.unbilledRevenue) return b.unbilledRevenue - a.unbilledRevenue;
    if (a.ageDays === null) return b.ageDays === null ? 0 : 1;
    if (b.ageDays === null) return -1;
    return b.ageDays - a.ageDays;
  });

  return {
    rows,
    totalUnbilled: rows.reduce((sum, row) => sum + row.unbilledRevenue, 0),
    count: rows.length,
  };
}

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pct: number | null; // share of base (published); null when base is 0
}

export interface CampaignFunnel {
  base: number;
  stages: FunnelStage[];
}

// Campaign production funnel (#14) — the three status dimensions (exec/result/
// report) are shown today as disconnected donuts and to-do lists, hiding WHERE
// work stalls after publish (e.g. lots published but results never collected).
// Base = published work (isPublishedWork: execStatus published|done); every
// stage is measured as a % of that SAME base, not chained sequentially —
// collected/achieved/reported are overlapping subsets of published work, not a
// strict pipeline, so expressing each as "% of published" is honest and avoids
// implying stages that don't strictly gate one another. Null-honesty mirrors
// attainmentSummary/customerHealth: base 0 => every stage pct is null, never a
// fake 0/100.
export function campaignFunnel(items: Item[]): CampaignFunnel {
  const published = items.filter(isPublishedWork);
  const base = published.length;
  const pct = (n: number) => (base ? Math.round((n / base) * 100) : null);

  const collectedCount = published.filter((item) => item.resultStatus !== "not_collected").length;
  const achievedCount = published.filter((item) => item.resultStatus === "achieved").length;
  const reportedCount = published.filter((item) => item.reportStatus === "sent").length;

  const stages: FunnelStage[] = [
    { key: "published", label: "เผยแพร่แล้ว", count: base, pct: base ? 100 : null },
    { key: "collected", label: "เก็บผลลัพธ์แล้ว", count: collectedCount, pct: pct(collectedCount) },
    { key: "achieved", label: "บรรลุผล", count: achievedCount, pct: pct(achievedCount) },
    { key: "reported", label: "ส่งรีพอร์ตแล้ว", count: reportedCount, pct: pct(reportedCount) },
  ];

  return { base, stages };
}

export interface GanttRow {
  label: string;
  start: number; // ms epoch
  end: number; // ms epoch
  color: string;
  item: Item;
}

export interface GanttOptions {
  /** Sort/group key for the returned rows — defaults to "customer". */
  groupBy?: "customer" | "itemType" | "salesOwner";
}

// Timeline (Gantt) rows for the "ไทม์ไลน์" view — one horizontal bar per item.
// start = publishDate, falling back to createdAt (every item always has one, so
// this never leaves a valid item without a start); end = finishedDate, falling
// back to deadline, falling back to a start+1day placeholder so a bar is never
// zero-width. Items with no resolvable start, or a computed end <= start (e.g.
// a mis-entered finishedDate/deadline before publishDate), are skipped rather
// than rendered as a broken/negative-width bar. Rows are pre-sorted by the
// requested group key (customer name by default) so the chart reads as
// contiguous per-group blocks without the view needing to re-group them.
export function buildGanttRows(
  items: Item[],
  customers: Customer[],
  opts: GanttOptions = {},
): GanttRow[] {
  const groupBy = opts.groupBy ?? "customer";
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  const rows: { row: GanttRow; groupKey: string }[] = [];

  items.forEach((item) => {
    const customer = customerById.get(item.customerId);
    const startDate = parseDate(item.publishDate) || parseDate(item.createdAt);
    if (!startDate) return;
    const start = startOfDay(startDate).getTime();

    const endDate = parseDate(item.finishedDate) || parseDate(item.deadline);
    const end = endDate ? startOfDay(endDate).getTime() : start + 86400000;
    if (end <= start) return;

    const customerName = customer?.name.trim() || "ไม่ระบุลูกค้า";
    const groupKey =
      groupBy === "itemType"
        ? item.itemType.trim() || "(ไม่ระบุรายการ)"
        : groupBy === "salesOwner"
          ? customer?.salesOwner.trim() || "ไม่ระบุเจ้าของงานขาย"
          : customerName;

    rows.push({
      row: {
        label: `${itemName(item)} · ${customerName}`,
        start,
        end,
        color: EXEC_MAP[item.execStatus]?.dot || EXEC_MAP.not_started.dot,
        item,
      },
      groupKey,
    });
  });

  rows.sort((a, b) => a.groupKey.localeCompare(b.groupKey, "th") || a.row.start - b.row.start);
  return rows.map((entry) => entry.row);
}
