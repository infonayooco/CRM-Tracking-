"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Megaphone,
  PackageCheck,
  ShoppingBag,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  money,
  salesByChannel,
  salesByCustomer,
  salesByItemType,
  salesByMonth,
  salesBySalesOwner,
  sortSalesRows,
  type SalesSortDir,
  type SalesSortKey,
  type SalesSummaryRow,
} from "@/lib/derived";
import type { Customer, Item } from "@/lib/types";
import { cardClass, emptyCardClass, sectionLabelClass } from "@/components/ui";

interface SalesSummaryProps {
  items: Item[];
  customers: Customer[];
}

// Compact so it fits inline in a section header (used 4x — one per breakdown).
const controlClass =
  "h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-ink outline-none transition focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100";

export function SalesSummary({ items, customers }: SalesSummaryProps) {
  // Base rows per breakdown — each section below owns its own sort state and
  // sorts independently, so no shared sort here (see BreakdownCard/ItemTypeSection).
  const itemTypeBaseRows = useMemo(() => salesByItemType(items), [items]);
  const customerBaseRows = useMemo(
    () => salesByCustomer(items, customers),
    [items, customers],
  );
  const channelBaseRows = useMemo(() => salesByChannel(items), [items]);
  const monthRows = useMemo(() => salesByMonth(items), [items]); // chronological — not sortable
  const ownerBaseRows = useMemo(
    () => salesBySalesOwner(items, customers),
    [items, customers],
  );
  const totalRevenue = useMemo(
    () => items.reduce((sum, item) => sum + (item.price || 0), 0),
    [items],
  );

  if (!items.length) return <EmptySalesSummary />;

  return (
    <section className="space-y-4" aria-label="รายงานยอดขาย">
      <header className={`${cardClass} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-light text-primary">
              <ShoppingBag className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted">ยอดขาย</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                จำนวนที่ขายตามข้อมูลที่เลือก
              </h2>
            </div>
          </div>
          <div className="tnum rounded-lg bg-primary-light px-4 py-3 text-right">
            <p className="text-xs font-semibold text-primary-dark">รวมทั้งหมด</p>
            <p className="mt-1 text-xl font-bold text-brand-700">
              รวม {formatCount(items.length)} งาน · {money(totalRevenue)}
            </p>
          </div>
        </div>
      </header>

      <ItemTypeSection rows={itemTypeBaseRows} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="ลูกค้าตามจำนวนขาย"
          icon={Users}
          rows={customerBaseRows}
          sectionLabel="ส่วนรายชื่อลูกค้า"
          limit={10}
          emptyLabel="ยังไม่มีลูกค้าในข้อมูลที่เลือก"
        />
        <BreakdownCard
          title="ช่องทาง"
          icon={Megaphone}
          rows={channelBaseRows}
          sectionLabel="ส่วนช่องทาง"
          emptyLabel="ยังไม่มีช่องทางในข้อมูลที่เลือก"
        />
        <BreakdownCard
          title="เดือน Publish"
          icon={CalendarDays}
          rows={monthRows}
          emptyLabel="ยังไม่มี Publish Date ในข้อมูลที่เลือก"
        />
        <BreakdownCard
          title="เจ้าของงานขาย"
          icon={UserRound}
          rows={ownerBaseRows}
          sectionLabel="ส่วนเจ้าของงาน"
          emptyLabel="ยังไม่มีเจ้าของงานขายในข้อมูลที่เลือก"
        />
      </div>
    </section>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h3 className={sectionLabelClass}>{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

// Clean ranked row (no bar): rank · ประเภทงาน · จำนวน (count) · มูลค่า (revenue),
// right-aligned. Mirrors the BreakdownCard rows below for a consistent, mobile-safe
// look. Rows arrive pre-sorted by ItemTypeSection's own sort state.
function ItemTypeRow({ row, rank }: { row: SalesSummaryRow; rank: number }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3">
      <span className="tnum grid size-7 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
        {rank}
      </span>
      <p className="tnum truncate text-base font-semibold text-ink">{row.label}</p>
      <div className="text-right">
        <span className="tnum block text-base font-bold text-ink">{formatCount(row.count)} งาน</span>
        <span className="tnum mt-0.5 block text-xs font-semibold text-muted">{money(row.revenue)}</span>
      </div>
    </div>
  );
}

// Standalone "ตามประเภทงาน" section (rendered above the 2-col breakdown grid).
// Owns its own sort state so sorting it never affects the other breakdowns.
function ItemTypeSection({ rows }: { rows: SalesSummaryRow[] }) {
  const [sortKey, setSortKey] = useState<SalesSortKey>("count");
  const [sortDir, setSortDir] = useState<SalesSortDir>("desc");
  const sortedRows = useMemo(
    () => sortSalesRows(rows, sortKey, sortDir),
    [rows, sortKey, sortDir],
  );

  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading
          icon={PackageCheck}
          title="จำนวนที่ขาย ตามประเภทงาน"
          description="ดูว่าสินค้าหรือแพ็กเกจไหนถูกขายมากที่สุดในช่วงที่เลือก"
        />
        <SortControl
          sortKey={sortKey}
          sortDir={sortDir}
          onSortKeyChange={setSortKey}
          onSortDirChange={setSortDir}
          sectionLabel="ส่วนประเภทงาน"
        />
      </div>
      <div className="mt-4 divide-y divide-border">
        {sortedRows.map((row, index) => (
          <ItemTypeRow key={row.label} row={row} rank={index + 1} />
        ))}
      </div>
    </section>
  );
}

// Compact select-pair for a section header. `sectionLabel` (e.g. "ส่วนประเภทงาน")
// disambiguates the aria-label per section, since each breakdown below sorts
// independently and several of these controls render on the page at once.
function SortControl({
  sortKey,
  sortDir,
  onSortKeyChange,
  onSortDirChange,
  sectionLabel,
}: {
  sortKey: SalesSortKey;
  sortDir: SalesSortDir;
  onSortKeyChange: (key: SalesSortKey) => void;
  onSortDirChange: (dir: SalesSortDir) => void;
  sectionLabel: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
      <select
        value={sortKey}
        onChange={(event) => onSortKeyChange(event.target.value as SalesSortKey)}
        className={controlClass}
        aria-label={`เรียงตามใน${sectionLabel}`}
      >
        <option value="count">จำนวนงาน</option>
        <option value="revenue">มูลค่า</option>
      </select>
      <select
        value={sortDir}
        onChange={(event) => onSortDirChange(event.target.value as SalesSortDir)}
        className={controlClass}
        aria-label={`ทิศทางการเรียงใน${sectionLabel}`}
      >
        <option value="desc">มาก → น้อย</option>
        <option value="asc">น้อย → มาก</option>
      </select>
    </div>
  );
}

function BreakdownCard({
  title,
  icon,
  rows,
  emptyLabel,
  sectionLabel,
  limit,
}: {
  title: string;
  icon: LucideIcon;
  rows: SalesSummaryRow[];
  emptyLabel: string;
  /** Presence enables this card's own independent sort control; omit for an unsorted list (e.g. the chronological month breakdown). */
  sectionLabel?: string;
  /** Applied AFTER sorting, so e.g. "top 10 customers" reflects the chosen sort. */
  limit?: number;
}) {
  const [sortKey, setSortKey] = useState<SalesSortKey>("count");
  const [sortDir, setSortDir] = useState<SalesSortDir>("desc");
  const displayRows = useMemo(() => {
    const sorted = sectionLabel ? sortSalesRows(rows, sortKey, sortDir) : rows;
    return limit ? sorted.slice(0, limit) : sorted;
  }, [rows, sectionLabel, sortKey, sortDir, limit]);

  return (
    <section className={`${cardClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SectionHeading icon={icon} title={title} />
        {sectionLabel ? (
          <SortControl
            sortKey={sortKey}
            sortDir={sortDir}
            onSortKeyChange={setSortKey}
            onSortDirChange={setSortDir}
            sectionLabel={sectionLabel}
          />
        ) : null}
      </div>
      {displayRows.length ? (
        <ol className="mt-3 divide-y divide-border">
          {displayRows.map((row, index) => (
            <li
              key={row.label}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-2.5"
            >
              <span className="tnum w-6 text-xs font-bold text-muted">
                {index + 1}
              </span>
              <span className="tnum truncate text-sm font-semibold text-ink">
                {row.label}
              </span>
              <span className="text-right">
                <span className="tnum block text-sm font-bold text-ink">
                  {formatCount(row.count)} งาน
                </span>
                <span className="tnum mt-0.5 block text-xs font-semibold text-muted">
                  {money(row.revenue)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-muted">
          {emptyLabel}
        </p>
      )}
    </section>
  );
}

function EmptySalesSummary() {
  return (
    <section className={emptyCardClass}>
      <div className="mx-auto grid size-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <BarChart3 className="size-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">ยังไม่มียอดขายในช่วงนี้</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted">
        ลองเลือกทุกเดือนหรือปรับตัวกรอง เพื่อดูจำนวนที่ขายตามประเภทงาน ลูกค้า ช่องทาง เดือน และเจ้าของงานขาย
      </p>
    </section>
  );
}

function formatCount(value: number) {
  return value.toLocaleString("th-TH");
}
