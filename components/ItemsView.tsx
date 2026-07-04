"use client";

import {
  AlertTriangle,
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  Kanban,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BoardView } from "@/components/BoardView";
import { StatusBadges } from "@/components/StatusBadges";
import { Button, Chip, cardClass, emptyCardClass, inputClass, sectionLabelClass } from "@/components/ui";
import { CHANNEL, CHANNEL_MAP, STATUS_DIM_KEYS, STATUS_DIMS } from "@/lib/constants";
import {
  customerRevenue,
  filteredItems,
  groupItemsByCustomer,
  groupItemsByItemType,
  groupItemsByQt,
  isDueSoon,
  isOverdue,
  itemName,
  money,
  parseDate,
  provinceLinkMismatch,
} from "@/lib/derived";
import { rankedItemTypeOptions } from "@/lib/itemTypeOptions";
import { safeHex, safeUrl } from "@/lib/normalize";
import { useStore } from "@/lib/store";
import type { ChannelKey, Customer, Item, StatusDimKey } from "@/lib/types";

const segmentButtonClass = (active: boolean) =>
  `inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors ${
    active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
  }`;
const presetChipClass =
  "inline-flex h-8 cursor-pointer items-center rounded-lg bg-primary-light px-2.5 text-xs font-semibold text-primary-dark transition-colors hover:bg-brand-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-100";
// Row-level one-tap status action (mirrors HomeView's quickActions) — hidden
// until hover/focus via the row's existing `group`/`group-hover` reveal, so
// the list stays clean and only surfaces a shortcut when it still applies.
const rowQuickActionClass =
  "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-success-light px-2.5 text-xs font-semibold text-success-dark opacity-0 transition-opacity hover:bg-success hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-100 focus-visible:opacity-100 group-hover:opacity-100";
// Compact secondary action on the QT header row — smaller than the global
// primary add button since it's a contextual shortcut, not the main CTA.
const qtAddButtonClass =
  "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-600 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100";

const rowDateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatRowDate(value: string) {
  const date = parseDate(value);
  return date ? rowDateFormatter.format(date) : "ไม่ระบุวันที่";
}

type DatePreset = "thisMonth" | "last30" | "thisQuarter" | "thisYear";
const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "last30", label: "30 วันล่าสุด" },
  { key: "thisQuarter", label: "ไตรมาสนี้" },
  { key: "thisYear", label: "ปีนี้" },
];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function dateRange(preset: DatePreset, now: Date): { dateFrom: string; dateTo: string } {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (preset) {
    case "thisMonth":
      return { dateFrom: isoDate(new Date(year, month, 1)), dateTo: isoDate(new Date(year, month + 1, 0)) };
    case "last30":
      return { dateFrom: isoDate(new Date(year, month, now.getDate() - 29)), dateTo: isoDate(now) };
    case "thisQuarter": {
      const quarterStart = Math.floor(month / 3) * 3;
      return {
        dateFrom: isoDate(new Date(year, quarterStart, 1)),
        dateTo: isoDate(new Date(year, quarterStart + 3, 0)),
      };
    }
    case "thisYear":
      return { dateFrom: isoDate(new Date(year, 0, 1)), dateTo: isoDate(new Date(year, 11, 31)) };
  }
}

export function ItemsView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const filters = useStore((state) => state.filters);
  const settings = useStore((state) => state.settings);
  const viewMode = useStore((state) => state.viewMode);
  const boardDim = useStore((state) => state.boardDim);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);
  const setViewMode = useStore((state) => state.setViewMode);
  const setBoardDim = useStore((state) => state.setBoardDim);
  const setFilter = useStore((state) => state.setFilter);
  const setFilters = useStore((state) => state.setFilters);
  const resetFilters = useStore((state) => state.resetFilters);
  const setStatusDim = useStore((state) => state.setStatusDim);
  const openNewItem = useStore((state) => state.openNewItem);
  const updateItems = useStore((state) => state.updateItems);

  // Bulk multi-select is a LIST-mode-only interaction — cleared whenever the
  // rep leaves list mode or resets filters, so a stale selection never
  // survives to a different slice of items. `setViewMode("board")` below is
  // the only place list mode is ever left from, so clearing it right there
  // (an event handler, not an effect) keeps the reset synchronous and simple.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // List-mode-only grouping toggle ("ตามลูกค้า" vs "ตามประเภทงาน") — a display
  // preference for this session, not a durable setting, so it stays local
  // state rather than joining the persisted view prefs in the store.
  const [groupBy, setGroupBy] = useState<"customer" | "itemType">("customer");

  // "ตัวกรองเพิ่มเติม" disclosure — tucks the long tail of less-used filters
  // (channel, itemType, หมวดสถานะ, เจ้าของงานขาย, จังหวัด, date range + presets)
  // behind a toggle so the primary trio (search/customer/status) isn't buried
  // under ~10 controls. Defaults collapsed, but the lazy initializer opens it
  // immediately if any of those filters is already active on mount (e.g. a
  // หมวดสถานะ carried over from a previous session, since statusDim persists) —
  // belt-and-suspenders on top of the ActiveFilterBar chips rendered above this
  // view (app/page.tsx), which already surface every active `filters` value
  // with its own clear button regardless of this disclosure's state, so an
  // active hidden filter is never invisible either way.
  const [showMoreFilters, setShowMoreFilters] = useState(
    () =>
      Boolean(
        filters.channel ||
          filters.itemType ||
          filters.salesOwner ||
          filters.province ||
          filters.dateFrom ||
          filters.dateTo,
      ) || statusDim !== "exec",
  );

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());
  const handleResetFilters = () => {
    resetFilters();
    clearSelection();
  };

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const customerOptions = useMemo(
    () => [...customers].sort((a, b) => a.name.localeCompare(b.name, "th")),
    [customers],
  );
  const salesOwnerOptions = useMemo(
    () =>
      [...new Set(customers.map((customer) => customer.salesOwner).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [customers],
  );
  const provinceOptions = useMemo(
    () =>
      [...new Set(customers.map((customer) => customer.province).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [customers],
  );
  const itemTypeOptions = useMemo(() => rankedItemTypeOptions(items), [items]);
  const visibleItems = useMemo(
    () =>
      filteredItems({
        customers,
        items,
        settings,
        filters,
        calDateField,
        statusDim,
      }),
    [customers, items, settings, filters, calDateField, statusDim],
  );
  const groupedCustomers = useMemo(() => groupItemsByCustomer(visibleItems), [visibleItems]);
  const groupedByItemType = useMemo(() => groupItemsByItemType(visibleItems), [visibleItems]);
  const visibleIds = useMemo(() => new Set(visibleItems.map((item) => item.id)), [visibleItems]);
  const activeStatusDim = STATUS_DIMS[statusDim];
  // Count of currently-collapsed filters that are non-default — badges the
  // "ตัวกรองเพิ่มเติม" toggle so a rep still knows something is filtering even
  // while the disclosure is closed.
  const hiddenActiveFilterCount = useMemo(() => {
    let count = 0;
    if (filters.channel) count += 1;
    if (filters.itemType) count += 1;
    if (statusDim !== "exec") count += 1;
    if (filters.salesOwner) count += 1;
    if (filters.province) count += 1;
    if (filters.dateFrom) count += 1;
    if (filters.dateTo) count += 1;
    return count;
  }, [
    filters.channel,
    filters.itemType,
    filters.salesOwner,
    filters.province,
    filters.dateFrom,
    filters.dateTo,
    statusDim,
  ]);

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedIds.has(item.id));
  const selectAllVisible = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleItems.map((item) => item.id)));
  };
  // selectedIds can go stale relative to the current filters (it is only
  // cleared on explicit clear / reset-filters / board switch, not on every
  // filter change) — so a batch action must intersect with what's actually
  // visible right now, or it could silently mutate items the rep can no
  // longer see (#8).
  const runBatchAction = (patch: Partial<Item>) => {
    updateItems([...selectedIds].filter((id) => visibleIds.has(id)), patch);
    clearSelection();
  };

  return (
    <section className="space-y-4">
      <div className={`${cardClass} p-5`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className={`mb-1 block ${sectionLabelClass}`}>ค้นหา</span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={filters.q}
                onChange={(event) => setFilter("q", event.target.value)}
                placeholder="ลูกค้า QT รายการ เป้าหมาย"
                className={`${inputClass} pl-9`}
              />
            </span>
          </label>

          <label className="block">
            <span className={`mb-1 block ${sectionLabelClass}`}>ลูกค้า</span>
            <select
              value={filters.customerId}
              onChange={(event) => setFilter("customerId", event.target.value)}
              className={inputClass}
            >
              <option value="">ทุกลูกค้า</option>
              {customerOptions.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={`mb-1 block ${sectionLabelClass}`}>สถานะ</span>
            <select
              value={filters.statusKey}
              onChange={(event) => setFilter("statusKey", event.target.value)}
              className={inputClass}
            >
              <option value="">ทุกสถานะ</option>
              {activeStatusDim.list.map((status) => (
                <option key={status.key} value={status.key}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowMoreFilters((prev) => !prev)}
            aria-expanded={showMoreFilters}
            aria-controls="items-more-filters"
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100 ${
              showMoreFilters
                ? "border-brand-600 bg-primary-light text-primary-dark"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-600 hover:text-brand-700"
            }`}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden="true" />
            ตัวกรองเพิ่มเติม
            {hiddenActiveFilterCount > 0 ? (
              <span
                className="tnum inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white"
                aria-label={`${hiddenActiveFilterCount} ตัวกรองเพิ่มเติมกำลังใช้งาน`}
              >
                {hiddenActiveFilterCount}
              </span>
            ) : null}
            <ChevronDown
              className={`size-3.5 transition-transform ${showMoreFilters ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={() => setFilter("overdue", !filters.overdue)}
            aria-pressed={filters.overdue}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100 ${
              filters.overdue
                ? "border-error bg-error-light text-error-dark"
                : "border-slate-200 bg-white text-slate-600 hover:border-error hover:text-error-dark"
            }`}
          >
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            งานค้าง
          </button>
        </div>

        {showMoreFilters ? (
          <div id="items-more-filters" className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>ช่องทาง</span>
                <select
                  value={filters.channel}
                  onChange={(event) => setFilter("channel", event.target.value)}
                  className={inputClass}
                >
                  <option value="">ทุกช่องทาง</option>
                  {CHANNEL.map((channel) => (
                    <option key={channel.key} value={channel.key}>
                      {channel.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>ประเภทงาน</span>
                <select
                  value={filters.itemType}
                  onChange={(event) => setFilter("itemType", event.target.value)}
                  className={inputClass}
                >
                  <option value="">ทุกประเภทงาน</option>
                  {itemTypeOptions.map((itemType) => (
                    <option key={itemType} value={itemType}>
                      {itemType}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>หมวดสถานะ</span>
                <select
                  value={statusDim}
                  onChange={(event) => setStatusDim(event.target.value as StatusDimKey)}
                  className={inputClass}
                >
                  {STATUS_DIM_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {STATUS_DIMS[key].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>เจ้าของงานขาย</span>
                <select
                  value={filters.salesOwner}
                  onChange={(event) => setFilter("salesOwner", event.target.value)}
                  className={inputClass}
                >
                  <option value="">ทุกเจ้าของงานขาย</option>
                  {salesOwnerOptions.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>จังหวัด</span>
                <select
                  value={filters.province}
                  onChange={(event) => setFilter("province", event.target.value)}
                  className={inputClass}
                >
                  <option value="">ทุกจังหวัด</option>
                  {provinceOptions.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>วันที่เริ่ม</span>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => setFilter("dateFrom", event.target.value)}
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={`mb-1 block ${sectionLabelClass}`}>วันที่สิ้นสุด</span>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => setFilter("dateTo", event.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className={sectionLabelClass}>ช่วงเวลา (Publish):</span>
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setFilters(dateRange(preset.key, new Date()))}
                  className={presetChipClass}
                >
                  {preset.label}
                </button>
              ))}
              {filters.dateFrom || filters.dateTo ? (
                <button
                  type="button"
                  onClick={() => setFilters({ dateFrom: "", dateTo: "" })}
                  className={presetChipClass}
                >
                  ล้างช่วง
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1"
              aria-label="เลือกมุมมองชิ้นงาน"
            >
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={segmentButtonClass(viewMode === "list")}
                aria-pressed={viewMode === "list"}
              >
                <List className="size-4" aria-hidden="true" />
                รายการ
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("board");
                  clearSelection();
                }}
                className={segmentButtonClass(viewMode === "board")}
                aria-pressed={viewMode === "board"}
              >
                <Kanban className="size-4" aria-hidden="true" />
                บอร์ด
              </button>
            </div>

            {viewMode === "list" ? (
              <div
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1"
                aria-label="เลือกการจัดกลุ่มรายการ"
              >
                <button
                  type="button"
                  onClick={() => setGroupBy("customer")}
                  className={segmentButtonClass(groupBy === "customer")}
                  aria-pressed={groupBy === "customer"}
                >
                  ตามลูกค้า
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy("itemType")}
                  className={segmentButtonClass(groupBy === "itemType")}
                  aria-pressed={groupBy === "itemType"}
                >
                  ตามประเภทงาน
                </button>
              </div>
            ) : null}

            {viewMode === "board" ? (
              <div
                className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 p-1"
                aria-label="เลือกมิติบอร์ด"
              >
                {STATUS_DIM_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBoardDim(key)}
                    className={segmentButtonClass(boardDim === key)}
                    aria-pressed={boardDim === key}
                  >
                    {STATUS_DIMS[key].label}
                  </button>
                ))}
              </div>
            ) : null}

            <p className="text-sm text-muted">
              แสดง{" "}
              <span className="font-semibold text-ink tnum">
                {visibleItems.length.toLocaleString("th-TH")}
              </span>{" "}
              จาก <span className="tnum">{items.length.toLocaleString("th-TH")}</span> ชิ้นงาน
            </p>

            {viewMode === "list" && visibleItems.length > 0 ? (
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-muted">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={selectAllVisible}
                  className="size-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-100"
                  aria-label="เลือกชิ้นงานที่แสดงทั้งหมด"
                />
                เลือกทั้งหมดที่แสดง
              </label>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => openNewItem()} className="cursor-pointer">
              <Plus className="size-4" aria-hidden="true" />
              เพิ่มชิ้นงาน
            </Button>
            <Button variant="ghost" onClick={handleResetFilters} className="cursor-pointer">
              <X className="size-4" aria-hidden="true" />
              ล้างตัวกรอง
            </Button>
          </div>
        </div>
      </div>

      {viewMode === "list" && selectedIds.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-primary-light px-4 py-3 shadow-card"
          role="toolbar"
          aria-label="การดำเนินการหลายรายการ"
        >
          <span className="text-sm font-semibold text-primary-dark">
            <CheckSquare className="mr-1 inline size-4" aria-hidden="true" />
            เลือกแล้ว <span className="tnum">{selectedIds.size.toLocaleString("th-TH")}</span> รายการ
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => runBatchAction({ execStatus: "published" })}
              className={presetChipClass}
            >
              ทำเครื่องหมายเผยแพร่แล้ว
            </button>
            <button
              type="button"
              onClick={() => runBatchAction({ resultStatus: "achieved" })}
              className={presetChipClass}
            >
              เก็บผลลัพธ์: บรรลุผล
            </button>
            <button
              type="button"
              onClick={() => runBatchAction({ reportStatus: "sent" })}
              className={presetChipClass}
            >
              ส่งรีพอร์ตแล้ว
            </button>
            <button type="button" onClick={clearSelection} className={presetChipClass}>
              ล้างการเลือก
            </button>
          </div>
        </div>
      ) : null}

      {viewMode === "board" ? (
        <BoardView />
      ) : visibleItems.length ? (
        <div className="space-y-4">
          {groupBy === "customer"
            ? groupedCustomers.map(([customerId, customerItems]) => (
                <CustomerGroup
                  key={customerId || "unknown"}
                  customer={customerById.get(customerId)}
                  customerId={customerId}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  customerItems={customerItems}
                  allItems={items}
                />
              ))
            : groupedByItemType.map(([itemTypeLabel, itemTypeItems]) => (
                <ItemTypeGroup
                  key={itemTypeLabel}
                  label={itemTypeLabel}
                  rows={itemTypeItems}
                  customerById={customerById}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                />
              ))}
        </div>
      ) : (
        <EmptyState hasItems={items.length > 0} />
      )}
    </section>
  );
}

function CustomerGroup({
  customer,
  customerId,
  customerItems,
  allItems,
  selectedIds,
  onToggleSelect,
}: {
  customer: Customer | undefined;
  customerId: string;
  customerItems: Item[];
  allItems: Item[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const qtGroups = groupItemsByQt(customerItems);
  const color = safeHex(customer?.color, "#64748b");

  return (
    <section className={`overflow-hidden ${cardClass}`}>
      <header className="border-b border-border bg-slate-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-3 shrink-0 rounded-full ring-2 ring-white"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            />
            <h2 className="truncate text-base font-semibold text-ink">
              {customer?.name || "ไม่ระบุลูกค้า"}
            </h2>
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand-700 tnum">
            {money(customerRevenue(allItems, customerId))}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {customer?.province || "ไม่ระบุจังหวัด"} ·{" "}
          {customer?.salesOwner || "ไม่ระบุเจ้าของงานขาย"} ·{" "}
          <span className="tnum">{customerItems.length.toLocaleString("th-TH")}</span> ชิ้นงาน
        </p>
      </header>

      <div className="divide-y divide-border-soft">
        {qtGroups.map(([qtNo, rows]) => (
          <QtGroup
            key={`${customerId}-${qtNo}`}
            qtNo={qtNo}
            rows={rows}
            customer={customer}
            customerId={customerId}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </section>
  );
}

// "Group by ประเภทงาน" (#itemType) view — a flat, lighter-weight sibling to
// CustomerGroup/QtGroup: a single itemType can span many customers, so this
// deliberately skips the QT sub-grouping and just lists rows straight under
// the itemType header, reusing ItemRow verbatim (including its selection
// checkbox and quick-duplicate action). Each row looks up ITS OWN customer
// from customerById, since — unlike CustomerGroup — the rows here don't all
// share one customer.
function ItemTypeGroup({
  label,
  rows,
  customerById,
  selectedIds,
  onToggleSelect,
}: {
  label: string;
  rows: Item[];
  customerById: Map<string, Customer>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const revenue = rows.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <section className={`overflow-hidden ${cardClass}`}>
      <header className="border-b border-border bg-slate-50/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={`min-w-0 truncate ${sectionLabelClass}`}>{label}</h2>
          <span className="shrink-0 text-sm font-semibold text-brand-700 tnum">{money(revenue)}</span>
        </div>
        <p className="mt-1 text-xs text-muted">
          <span className="tnum">{rows.length.toLocaleString("th-TH")}</span> ชิ้นงาน
        </p>
      </header>

      <div className="divide-y divide-border-soft px-4">
        {rows.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            customer={customerById.get(item.customerId)}
            selected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </section>
  );
}

// Picks the most common channel among a QT's rows — a contextual "add to
// this QT" should default to whatever channel the quotation is already
// mostly running on, not force the rep to re-pick it every line. Falls back
// to the first row's channel (ties keep whichever channel appeared first),
// then "web" when the QT has no rows at all.
function dominantChannel(rows: Item[]): ChannelKey {
  const counts = new Map<ChannelKey, number>();
  for (const row of rows) {
    counts.set(row.channel, (counts.get(row.channel) || 0) + 1);
  }
  let bestChannel: ChannelKey = rows[0]?.channel || "web";
  let bestCount = 0;
  for (const [channel, count] of counts) {
    if (count > bestCount) {
      bestChannel = channel;
      bestCount = count;
    }
  }
  return bestChannel;
}

function QtGroup({
  qtNo,
  rows,
  customer,
  customerId,
  selectedIds,
  onToggleSelect,
}: {
  qtNo: string;
  rows: Item[];
  customer: Customer | undefined;
  customerId: string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  const openNewItem = useStore((state) => state.openNewItem);
  const invText = [...new Set(rows.map((item) => item.invNo).filter(Boolean))].join(", ");
  const revenue = rows.reduce((sum, item) => sum + (item.price || 0), 0);

  const handleAddToQt = () => {
    openNewItem({ customerId, qtNo, channel: dominantChannel(rows) });
  };

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-border-soft">
        <div className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <FileText className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="truncate">{qtNo}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-xs text-muted">
            {invText ? `INV ${invText} · ` : ""}
            <span className="tnum">{rows.length.toLocaleString("th-TH")}</span> ชิ้นงาน ·{" "}
            <span className="font-semibold text-ink tnum">{money(revenue)}</span>
          </span>
          <button
            type="button"
            onClick={handleAddToQt}
            className={qtAddButtonClass}
            aria-label={`เพิ่มชิ้นงานในใบ ${qtNo}`}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            เพิ่มในใบนี้
          </button>
        </div>
      </div>

      <div className="ml-2 divide-y divide-border-soft border-l border-border-soft pl-3">
        {rows.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            customer={customer}
            selected={selectedIds.has(item.id)}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ItemRow({
  item,
  customer,
  selected,
  onToggleSelect,
}: {
  item: Item;
  customer: Customer | undefined;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  const href = safeUrl(item.link);
  const hasProvinceLinkMismatch = provinceLinkMismatch(item, customer);
  const openItemModal = useStore((state) => state.openItemModal);
  const duplicateItem = useStore((state) => state.duplicateItem);
  const updateItem = useStore((state) => state.updateItem);

  // Differentiator-first: item.detail (what actually varies row-to-row) leads
  // as the bold headline; itemType only fills in when there is no detail to
  // show, so a row is never left with a blank headline.
  const detail = item.detail.trim();
  const headline = detail || itemName(item);
  const showTypeChip = Boolean(detail && item.itemType.trim());
  const governingDate = item.publishDate || item.deadline;

  const handleDuplicate = () => {
    const newId = duplicateItem(item.id);
    if (newId) openItemModal(newId);
  };

  // Row-level one-tap status flips (#quick-actions) — same idea as HomeView's
  // AttentionRow quickActions: only show a shortcut while it still applies,
  // so an already-published, already-reported item shows no status buttons
  // at all (just duplicate/link). canPublish and canMarkAchieved are
  // mutually exclusive by construction (achieved only matters once published),
  // which also keeps the revealed cluster from ever showing every button at once.
  const canPublish = item.execStatus === "not_started" || item.execStatus === "in_progress";
  const canMarkReportSent = item.reportStatus !== "sent";
  const canMarkAchieved =
    item.resultStatus !== "achieved" &&
    (item.execStatus === "published" || item.execStatus === "done");

  return (
    <article className="group flex flex-wrap items-start gap-3 py-2 sm:flex-nowrap">
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggleSelect(item.id)}
        className="mt-2.5 size-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-100"
        aria-label={`เลือก ${itemName(item)}`}
      />
      <button
        type="button"
        onClick={() => openItemModal(item.id)}
        className="min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
        aria-label={`แก้ไขชิ้นงาน ${headline}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex shrink-0 items-center rounded-lg px-2 py-0.5 text-xs font-semibold text-white"
            style={{ backgroundColor: channel.color }}
            title={`ช่องทาง ${channel.label}`}
          >
            {channel.label}
          </span>
          {showTypeChip ? (
            <Chip tone="muted" className="shrink-0">
              {itemName(item)}
            </Chip>
          ) : null}
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{headline}</h3>
          {hasProvinceLinkMismatch ? (
            <span
              className="inline-flex shrink-0 text-warning-dark"
              title="ลิงก์ชี้จังหวัดอื่น — ตรวจข้อมูลจังหวัด"
              aria-label="ลิงก์ชี้จังหวัดอื่น — ตรวจข้อมูลจังหวัด"
            >
              <AlertTriangle className="size-4" aria-hidden="true" />
            </span>
          ) : null}
          {item.rating > 0 ? <Rating value={item.rating} /> : null}
        </div>

        {governingDate ? (
          <p className="tnum mt-1 text-xs text-muted">{formatRowDate(governingDate)}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusBadges item={item} />
          <UrgencyBadge item={item} />
          <span className="ml-auto shrink-0 text-sm font-semibold text-ink tnum">
            {money(item.price)}
          </span>
        </div>
      </button>

      <div className="flex shrink-0 flex-wrap items-center gap-1">
        {canPublish ? (
          <button
            type="button"
            onClick={() => updateItem(item.id, { execStatus: "published" })}
            className={rowQuickActionClass}
            aria-label={`เผยแพร่แล้ว: ${itemName(item)}`}
            title="ทำเครื่องหมายเผยแพร่แล้ว"
          >
            <Check className="size-3.5" aria-hidden="true" />
            เผยแพร่แล้ว
          </button>
        ) : null}
        {canMarkReportSent ? (
          <button
            type="button"
            onClick={() => updateItem(item.id, { reportStatus: "sent" })}
            className={rowQuickActionClass}
            aria-label={`ส่งรีพอร์ตแล้ว: ${itemName(item)}`}
            title="ทำเครื่องหมายส่งรีพอร์ตแล้ว"
          >
            <Check className="size-3.5" aria-hidden="true" />
            ส่งรีพอร์ตแล้ว
          </button>
        ) : null}
        {canMarkAchieved ? (
          <button
            type="button"
            onClick={() => updateItem(item.id, { resultStatus: "achieved" })}
            className={rowQuickActionClass}
            aria-label={`บรรลุผล: ${itemName(item)}`}
            title="ทำเครื่องหมายบรรลุผล"
          >
            <Check className="size-3.5" aria-hidden="true" />
            บรรลุผล
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleDuplicate}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 focus-visible:opacity-100 group-hover:opacity-100"
          aria-label={`ทำซ้ำ ${itemName(item)}`}
          title="ทำซ้ำชิ้นงาน"
        >
          <Copy className="size-4" aria-hidden="true" />
        </button>

        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600"
            aria-label={`เปิดลิงก์ชิ้นงาน ${itemName(item)} ในแท็บใหม่`}
            title="เปิดลิงก์ชิ้นงาน"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </article>
  );
}

function UrgencyBadge({ item }: { item: Item }) {
  if (isOverdue(item)) {
    return (
      <Chip tone="error">
        <AlertTriangle className="size-3" aria-hidden="true" />
        เกินกำหนด
      </Chip>
    );
  }
  if (isDueSoon(item)) {
    return (
      <Chip tone="warning">
        <Clock className="size-3" aria-hidden="true" />
        ใกล้ครบกำหนด
      </Chip>
    );
  }
  return null;
}

function Rating({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-warning"
      title={`${value.toLocaleString("th-TH")} ดาว`}
      aria-label={`${value.toLocaleString("th-TH")} ดาว`}
    >
      {Array.from({ length: value }, (_, index) => (
        <Star key={index} className="size-3 fill-current" aria-hidden="true" />
      ))}
    </span>
  );
}

function EmptyState({ hasItems }: { hasItems: boolean }) {
  return (
    <div className={`grid place-items-center ${emptyCardClass}`}>
      <span className="grid size-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Search className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-3 font-semibold text-ink">
        {hasItems ? "ไม่พบชิ้นงานที่ตรงกับตัวกรอง" : "ยังไม่มีชิ้นงาน"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {hasItems ? "ลองล้างตัวกรอง" : "โหลดข้อมูลจริงของทีมเพื่อเริ่มต้น"}
      </p>
    </div>
  );
}
