"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUpDown, Plus, Search, TriangleAlert, Users, Wallet } from "lucide-react";
import { money } from "@/lib/derived";
import { safeHex } from "@/lib/normalize";
import type { Customer } from "@/lib/types";
import { Button, Chip, cardClass, emptyCardClass, inputClass } from "@/components/ui";

export type SortKey = "name" | "revenue" | "items" | "achieved" | "progress" | "attention";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "เรียง: ชื่อ (ก-ฮ)" },
  { value: "revenue", label: "เรียง: รายได้สูงสุด" },
  { value: "items", label: "เรียง: ชิ้นงานมากสุด" },
  { value: "attention", label: "เรียง: งานค้างมากสุด" },
  { value: "achieved", label: "เรียง: %บรรลุผลสูงสุด" },
  { value: "progress", label: "เรียง: ความคืบหน้าสูงสุด" },
];

const selectClass = `${inputClass} appearance-none`;

export interface CustomerRow {
  customer: Customer;
  itemCount: number;
  revenue: number;
  progress: number;
  achieved: number;
  attention: number;
}

interface CustomerListProps {
  rows: CustomerRow[];
  totalRevenue: number;
  totalAttention: number;
  query: string;
  onQueryChange: (value: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  provinceFilter: string;
  onProvinceFilterChange: (value: string) => void;
  sortKey: SortKey;
  onSortKeyChange: (value: SortKey) => void;
  owners: string[];
  provinces: string[];
  selectedCustomerId: string | null;
  onSelectCustomer: (id: string) => void;
  onAddCustomer: () => void;
}

/** LEFT pane of the Contacts-style master-detail view: summary stats, search
 * + filters + sort (moved here from the old single-pane header), and the
 * keyboard-navigable customer list itself. */
export function CustomerList({
  rows,
  totalRevenue,
  totalAttention,
  query,
  onQueryChange,
  ownerFilter,
  onOwnerFilterChange,
  provinceFilter,
  onProvinceFilterChange,
  sortKey,
  onSortKeyChange,
  owners,
  provinces,
  selectedCustomerId,
  onSelectCustomer,
  onAddCustomer,
}: CustomerListProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Roving-focus arrow-key navigation (mirrors CommandPalette's listbox/option
  // pattern already used elsewhere in this app) — ArrowDown/ArrowUp move the
  // actual selection (there is no separate "highlighted vs selected" concept
  // here, unlike the palette) and move real DOM focus to the newly active row.
  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!rows.length) return;
    event.preventDefault();

    const currentIndex = rows.findIndex((row) => row.customer.id === selectedCustomerId);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), rows.length - 1);
    const nextCustomerId = rows[nextIndex].customer.id;

    onSelectCustomer(nextCustomerId);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-customer-row="${nextCustomerId}"]`)?.focus();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <SummaryStat icon={Users} label="ลูกค้า" value={rows.length.toLocaleString("th-TH")} />
            <SummaryStat icon={Wallet} label="รายได้รวม" value={money(totalRevenue)} tone="brand" />
            <SummaryStat
              icon={TriangleAlert}
              label="งานค้าง/โอกาส"
              value={totalAttention.toLocaleString("th-TH")}
              tone="amber"
            />
          </div>
          <Button type="button" variant="primary" onClick={onAddCustomer} aria-label="เพิ่มลูกค้าใหม่">
            <Plus className="size-4" aria-hidden="true" />
            เพิ่มลูกค้า
          </Button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <label className="relative sm:col-span-2">
            <span className="sr-only">ค้นหาลูกค้า</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="ค้นหาลูกค้า / จังหวัด / เจ้าของงาน"
              className={`${inputClass} pl-9`}
            />
          </label>

          <select
            value={ownerFilter}
            onChange={(event) => onOwnerFilterChange(event.target.value)}
            className={selectClass}
            aria-label="กรองตามเจ้าของงานขาย"
          >
            <option value="">ทุกเจ้าของงานขาย</option>
            {owners.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>

          <select
            value={provinceFilter}
            onChange={(event) => onProvinceFilterChange(event.target.value)}
            className={selectClass}
            aria-label="กรองตามจังหวัด"
          >
            <option value="">ทุกจังหวัด</option>
            {provinces.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>

          <span className="relative sm:col-span-2">
            <ArrowUpDown
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <select
              value={sortKey}
              onChange={(event) => onSortKeyChange(event.target.value as SortKey)}
              className={`${selectClass} pl-9`}
              aria-label="เรียงลำดับลูกค้า"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </span>
        </div>
      </section>

      {rows.length ? (
        <div
          ref={listRef}
          role="listbox"
          aria-label="รายชื่อลูกค้า"
          onKeyDown={handleListKeyDown}
          className={`${cardClass} min-h-0 flex-1 space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-19rem)]`}
        >
          {rows.map((row) => (
            <CustomerListRow
              key={row.customer.id}
              row={row}
              selected={row.customer.id === selectedCustomerId}
              onSelect={() => onSelectCustomer(row.customer.id)}
            />
          ))}
        </div>
      ) : (
        <NoMatch />
      )}
    </div>
  );
}

function CustomerListRow({
  row,
  selected,
  onSelect,
}: {
  row: CustomerRow;
  selected: boolean;
  onSelect: () => void;
}) {
  const { customer, attention } = row;
  const color = safeHex(customer.color, "#64748b");

  return (
    <button
      type="button"
      data-customer-row={customer.id}
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 ${
        selected ? "bg-primary-light" : "hover:bg-slate-100"
      }`}
    >
      <span
        className="grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        {customerInitial(customer.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{customer.name}</span>
        <span className="block truncate text-sm text-muted">
          {customer.province || "ไม่ระบุจังหวัด"} · {customer.salesOwner || "ไม่ระบุเจ้าของงานขาย"}
        </span>
      </span>
      {attention > 0 ? (
        <Chip tone="warning" className="shrink-0">
          {attention.toLocaleString("th-TH")} ค้าง
        </Chip>
      ) : (
        <Chip tone="success" className="shrink-0">
          ปกติ
        </Chip>
      )}
    </button>
  );
}

function customerInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: "slate" | "brand" | "amber";
}) {
  const valueTone =
    tone === "brand" ? "text-primary" : tone === "amber" ? "text-warning-dark" : "text-ink";
  const iconTone =
    tone === "brand"
      ? "bg-primary-light text-primary"
      : tone === "amber"
        ? "bg-warning-light text-warning-dark"
        : "bg-slate-100 text-slate-600";
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${iconTone}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className={`tnum text-lg font-bold ${valueTone}`}>{value}</p>
      </div>
    </div>
  );
}

function NoMatch() {
  return (
    <div className={`${emptyCardClass} grid place-items-center`}>
      <Search className="size-8 text-slate-300" aria-hidden="true" />
      <p className="mt-3 font-semibold text-ink">ไม่พบลูกค้าที่ตรงกับตัวกรอง</p>
      <p className="mt-1 text-sm text-muted">ลองล้างคำค้นหรือปรับตัวกรอง</p>
    </div>
  );
}
