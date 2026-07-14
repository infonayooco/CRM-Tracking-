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

const controlClass =
  "h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-ink outline-none transition focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100";

export function SalesSummary({ items, customers }: SalesSummaryProps) {
  const [sortKey, setSortKey] = useState<SalesSortKey>("count");
  const [sortDir, setSortDir] = useState<SalesSortDir>("desc");
  const itemTypeRows = useMemo(
    () => sortSalesRows(salesByItemType(items), sortKey, sortDir),
    [items, sortKey, sortDir],
  );
  const customerRows = useMemo(
    // sort BEFORE the top-10 slice so "least" shows the correct 10
    () => sortSalesRows(salesByCustomer(items, customers), sortKey, sortDir).slice(0, 10),
    [items, customers, sortKey, sortDir],
  );
  const channelRows = useMemo(
    () => sortSalesRows(salesByChannel(items), sortKey, sortDir),
    [items, sortKey, sortDir],
  );
  const monthRows = useMemo(() => salesByMonth(items), [items]); // chronological — not re-sorted
  const ownerRows = useMemo(
    () => sortSalesRows(salesBySalesOwner(items, customers), sortKey, sortDir),
    [items, customers, sortKey, sortDir],
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

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs font-semibold text-muted">เรียงตาม</span>
          <select
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SalesSortKey)}
            className={controlClass}
            aria-label="เรียงตามตัวชี้วัด"
          >
            <option value="count">จำนวนงาน</option>
            <option value="revenue">มูลค่า</option>
          </select>
          <select
            value={sortDir}
            onChange={(event) => setSortDir(event.target.value as SalesSortDir)}
            className={controlClass}
            aria-label="ทิศทางการเรียง"
          >
            <option value="desc">มาก → น้อย</option>
            <option value="asc">น้อย → มาก</option>
          </select>
        </div>
      </header>

      <section className={`${cardClass} p-4 sm:p-5`}>
        <SectionHeading
          icon={PackageCheck}
          title="จำนวนที่ขาย ตามประเภทงาน"
          description="ดูว่าสินค้าหรือแพ็กเกจไหนถูกขายมากที่สุดในช่วงที่เลือก"
        />
        <div className="mt-4 divide-y divide-border">
          {itemTypeRows.map((row, index) => (
            <ItemTypeRow key={row.label} row={row} rank={index + 1} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="ลูกค้าตามจำนวนขาย"
          icon={Users}
          rows={customerRows}
          emptyLabel="ยังไม่มีลูกค้าในข้อมูลที่เลือก"
        />
        <BreakdownCard
          title="ช่องทาง"
          icon={Megaphone}
          rows={channelRows}
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
          rows={ownerRows}
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
// look. Rows arrive pre-sorted by count desc from salesByItemType.
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

function BreakdownCard({
  title,
  icon,
  rows,
  emptyLabel,
}: {
  title: string;
  icon: LucideIcon;
  rows: SalesSummaryRow[];
  emptyLabel: string;
}) {
  return (
    <section className={`${cardClass} p-4`}>
      <SectionHeading icon={icon} title={title} />
      {rows.length ? (
        <ol className="mt-3 divide-y divide-border">
          {rows.map((row, index) => (
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
