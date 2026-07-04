"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ExternalLink, FileText, Printer, X } from "lucide-react";
import { CHANNEL_MAP, THAI_MONTHS_FULL } from "@/lib/constants";
import { achievedPercent, groupItemsByQt, itemName, lineHref, mailtoHref, money, telHref } from "@/lib/derived";
import { safeUrl } from "@/lib/normalize";
import { useStore } from "@/lib/store";
import type { Customer, Item } from "@/lib/types";
import {
  StatTile,
  cardClass,
  emptyCardClass,
  ghostBtnClass,
  primaryBtnClass,
  sectionLabelClass,
} from "@/components/ui";
import { StatusBadges } from "./StatusBadges";

const primaryActionClass = primaryBtnClass;
const secondaryActionClass = ghostBtnClass;

export function CustomerReport() {
  const reportCustomerId = useStore((state) => state.reportCustomerId);
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const closeCustomerReport = useStore((state) => state.closeCustomerReport);

  const customer = useMemo(
    () => customers.find((candidate) => candidate.id === reportCustomerId),
    [customers, reportCustomerId],
  );
  const customerItems = useMemo(
    () => (reportCustomerId ? items.filter((item) => item.customerId === reportCustomerId) : []),
    [items, reportCustomerId],
  );
  const [groupBy, setGroupBy] = useState<"qt" | "inv">("qt");
  const groups = useMemo(() => {
    if (groupBy === "qt") return groupItemsByQt(customerItems);
    const map = new Map<string, Item[]>();
    for (const item of customerItems) {
      const key = item.invNo?.trim() || "ไม่มี INV";
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [groupBy, customerItems]);
  const reportMonth = useMemo(() => getReportMonthLabel(customerItems), [customerItems]);

  if (!reportCustomerId) return null;

  if (!customer) {
    return (
      <ReportShell title="ไม่พบข้อมูลลูกค้า">
        <header className={`flex flex-wrap items-center justify-between gap-3 ${cardClass} p-5`}>
          <div>
            <p className="text-sm font-semibold text-primary">รายงานการสื่อสารการตลาด</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">ไม่พบข้อมูลลูกค้า</h1>
          </div>
          <button
            type="button"
            onClick={closeCustomerReport}
            className={`print-report-actions ${secondaryActionClass}`}
          >
            <X className="size-4" aria-hidden="true" />
            ปิด
          </button>
        </header>
        <div className={emptyCardClass}>
          <p className="text-lg font-semibold text-ink">ไม่พบข้อมูลลูกค้าสำหรับรีพอร์ตนี้</p>
          <p className="mt-1 text-sm text-muted">ปิดหน้าต่างนี้แล้วเลือกรีพอร์ตจากหน้าลูกค้าอีกครั้ง</p>
        </div>
      </ReportShell>
    );
  }

  const totalValue = customerItems.reduce((sum, item) => sum + (item.price || 0), 0);
  const reportSentPercent = customerItems.length
    ? Math.round((customerItems.filter((item) => item.reportStatus === "sent").length / customerItems.length) * 100)
    : 0;
  const ratedItems = customerItems.filter((item) => item.rating > 0);
  const averageRating = ratedItems.length
    ? ratedItems.reduce((sum, item) => sum + item.rating, 0) / ratedItems.length
    : 0;

  return (
    <ReportShell title={`รายงานการสื่อสารการตลาด — ${customer.name}`}>
      <header className={`${cardClass} p-5 sm:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">
              รายงานการสื่อสารการตลาด — {customer.name}
            </p>
            <h1 id="customer-report-title" className="mt-1 text-2xl font-bold text-pretty text-ink">
              {customer.name}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              <span>จังหวัด: {customer.province || "ไม่ระบุจังหวัด"}</span>
              <span>เจ้าของงานขาย: {customer.salesOwner || "ไม่ระบุเจ้าของงานขาย"}</span>
              {reportMonth ? <span>เดือนรายงาน: {reportMonth}</span> : null}
            </div>
            {customer.contactPerson || customer.phone || customer.email || customer.lineId ? (
              <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
                {customer.contactPerson ? <span>ผู้ติดต่อ: {customer.contactPerson}</span> : null}
                {telHref(customer.phone) ? (
                  <a
                    href={telHref(customer.phone)!}
                    className="text-primary hover:underline"
                    aria-label={`โทร ${customer.phone}`}
                  >
                    โทร: {customer.phone}
                  </a>
                ) : null}
                {mailtoHref(customer.email) ? (
                  <a
                    href={mailtoHref(customer.email)!}
                    className="text-primary hover:underline"
                    aria-label={`อีเมล ${customer.email}`}
                  >
                    อีเมล: {customer.email}
                  </a>
                ) : null}
                {lineHref(customer.lineId) ? (
                  <a
                    href={lineHref(customer.lineId)!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                    aria-label={`เปิด LINE ${customer.lineId}`}
                  >
                    LINE: {customer.lineId}
                  </a>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="print-report-actions flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center rounded-lg border border-border-soft bg-white p-1"
              role="group"
              aria-label="จัดกลุ่มรายงาน"
            >
              {(["qt", "inv"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupBy(mode)}
                  aria-pressed={groupBy === mode}
                  className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
                    groupBy === mode ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:bg-slate-100"
                  }`}
                >
                  {mode === "qt" ? "ตาม QO" : "ตาม INV"}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => window.print()} className={primaryActionClass}>
              <Printer className="size-4" aria-hidden="true" />
              พิมพ์ / บันทึก PDF
            </button>
            <button type="button" onClick={closeCustomerReport} className={secondaryActionClass}>
              <X className="size-4" aria-hidden="true" />
              ปิด
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-label="สรุปภาพรวมลูกค้า">
        <StatTile tone="primary" label="จำนวนชิ้นงาน" value={customerItems.length.toLocaleString("th-TH")} />
        <StatTile tone="success" label="มูลค่ารวม" value={money(totalValue)} />
        <StatTile
          tone="info"
          label="%บรรลุผล"
          value={`${achievedPercent(customerItems).toLocaleString("th-TH")}%`}
        />
        <StatTile
          tone="secondary"
          label="%ส่งรีพอร์ต"
          value={`${reportSentPercent.toLocaleString("th-TH")}%`}
        />
        <StatTile
          tone="warning"
          label="คะแนนเฉลี่ย"
          value={`⭐ ${averageRating.toLocaleString("th-TH", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })} · จาก ${ratedItems.length.toLocaleString("th-TH")} งาน`}
        />
      </section>

      {customerItems.length ? (
        <section className="space-y-4" aria-label={`รายการชิ้นงานตาม ${groupBy === "qt" ? "QO" : "INV"}`}>
          {groups.map(([key, rows]) => (
            <ReportGroup key={key} groupBy={groupBy} groupKey={key} rows={rows} />
          ))}
        </section>
      ) : (
        <EmptyReport customer={customer} />
      )}
    </ReportShell>
  );
}

function ReportShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="print-report fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-slate-100 px-4 py-4 text-ink sm:px-6 sm:py-6"
    >
      <div className="print-page mx-auto max-w-6xl space-y-4">
        <div className="space-y-4">{children}</div>
      </div>
    </section>
  );
}

function ReportGroup({
  groupBy,
  groupKey,
  rows,
}: {
  groupBy: "qt" | "inv";
  groupKey: string;
  rows: Item[];
}) {
  const primaryLabel = groupBy === "qt" ? "QT" : "INV";
  const otherLabel = groupBy === "qt" ? "INV" : "QT";
  const otherText = [
    ...new Set(rows.map((item) => (groupBy === "qt" ? item.invNo : item.qtNo)).filter(Boolean)),
  ].join(", ");
  const subtotal = rows.reduce((sum, item) => sum + (item.price || 0), 0);

  return (
    <section className={`print-qt-group overflow-hidden ${cardClass}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-soft bg-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-light text-primary">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <h2 className="truncate text-base font-bold text-ink">
            {primaryLabel}: {groupKey}
          </h2>
        </div>
        <p className="tnum text-sm font-semibold text-muted">
          {otherLabel}: {otherText || "-"} · ยอดรวม {money(subtotal)}
        </p>
      </div>

      <div className="divide-y divide-border">
        {rows.map((item) => (
          <ReportItem key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}

function ReportItem({ item }: { item: Item }) {
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  const href = safeUrl(item.link);

  return (
    <article className="grid gap-4 px-5 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(14rem,auto)]">
      <div className="min-w-0">
        <p className={sectionLabelClass}>รายการ</p>
        <h3 className="mt-1 text-base font-bold text-ink">{itemName(item)}</h3>
        <p className="mt-2 text-sm text-muted">
          ช่องทาง: <span className="font-semibold text-ink">{channel.label}</span>
        </p>
      </div>

      <div className="min-w-0">
        <p className={sectionLabelClass}>เป้าหมาย → ผลลัพธ์จริง</p>
        <div className="mt-2 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <ResultBox label="เป้าหมาย" value={item.target} />
          <div className="hidden items-center justify-center text-slate-300 sm:flex" aria-hidden="true">
            <ArrowRight className="size-4" />
          </div>
          <ResultBox label="ผลลัพธ์จริง" value={item.actual} tone="brand" />
        </div>
        <MetricLine item={item} />
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <StatusBadges item={item} />
        <div className="tnum flex flex-wrap items-center gap-2 text-sm font-semibold text-ink lg:justify-end">
          <span>{money(item.price)}</span>
          <span>⭐ {item.rating.toLocaleString("th-TH")}/5</span>
        </div>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border-soft px-3 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:ring-offset-2"
          >
            Link งาน
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-sm font-semibold text-muted">ไม่มี Link งาน</span>
        )}
      </div>
    </article>
  );
}

function MetricLine({ item }: { item: Item }) {
  const hasNumeric = item.targetValue != null || item.actualValue != null;
  if (!item.metricName && !hasNumeric) return null;
  const pct =
    item.targetValue && item.actualValue != null
      ? Math.round((item.actualValue / item.targetValue) * 100)
      : null;
  return (
    <p className="tnum mt-2 text-sm text-ink">
      <span className="font-semibold">{item.metricName || "ตัววัดผล"}:</span>{" "}
      {item.targetValue != null ? item.targetValue.toLocaleString("th-TH") : "—"} →{" "}
      {item.actualValue != null ? item.actualValue.toLocaleString("th-TH") : "—"}
      {item.metricUnit ? ` ${item.metricUnit}` : ""}
      {pct !== null ? (
        <span
          className={`ml-2 font-semibold ${pct >= 100 ? "text-success-dark" : "text-warning-dark"}`}
        >
          {pct.toLocaleString("th-TH")}% ของเป้า
        </span>
      ) : null}
    </p>
  );
}

function ResultBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "brand";
}) {
  return (
    <div
      className={`min-h-20 rounded-lg border p-3 ${
        tone === "brand" ? "border-primary/20 bg-primary-light" : "border-border-soft bg-slate-100"
      }`}
    >
      <p className={sectionLabelClass}>{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{value || "-"}</p>
    </div>
  );
}

function EmptyReport({ customer }: { customer: Customer }) {
  return (
    <div className={emptyCardClass}>
      <p className="text-lg font-semibold text-ink">ยังไม่มีชิ้นงานสำหรับ {customer.name}</p>
      <p className="mt-1 text-sm text-muted">
        เมื่อมีชิ้นงานของลูกค้ารายนี้ ระบบจะแสดงรายละเอียดตาม QT ในรีพอร์ตนี้
      </p>
    </div>
  );
}

function getReportMonthLabel(items: Item[]) {
  const monthKeys = [
    ...new Set(
      items
        .map((item) => item.publishDate.slice(0, 7))
        .filter((value) => /^\d{4}-\d{2}$/.test(value)),
    ),
  ];

  if (monthKeys.length !== 1) return "";

  const [year, month] = monthKeys[0].split("-");
  const monthName = THAI_MONTHS_FULL[Number(month) - 1];
  if (!monthName) return "";

  return `${monthName} ${Number(year) + 543}`;
}
