"use client";

import { useMemo } from "react";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  TrendingUp,
  TriangleAlert,
  User,
  Wallet,
} from "lucide-react";
import {
  achievedPercent,
  customerProgress,
  customerRevenue,
  itemName,
  lineHref,
  mailtoHref,
  money,
  telHref,
  type CustomerHealth,
} from "@/lib/derived";
import { safeHex } from "@/lib/normalize";
import type { Customer, Item } from "@/lib/types";
import { Button, Chip, StatTile, cardClass } from "@/components/ui";
import { StatusBadges } from "@/components/StatusBadges";

// Mirrors CustomerHealthTierBadge's tone mapping in ReportView so the risk
// language reads consistently everywhere the app surfaces account health.
const HEALTH_TIER_META: Record<
  CustomerHealth["tier"],
  { label: string; tone: "error" | "warning" | "success" }
> = {
  "at-risk": { label: "เสี่ยงสูง", tone: "error" },
  watch: { label: "จับตา", tone: "warning" },
  healthy: { label: "แข็งแรง", tone: "success" },
};

// Compact item list is capped so the detail pane stays scannable — "ดูชิ้นงานทั้งหมด"
// hands off to the full filtered Items view (existing openCustomerItems handler).
const MAX_VISIBLE_ITEMS = 8;

interface CustomerDetailPaneProps {
  customer: Customer;
  items: Item[];
  health?: CustomerHealth;
  attention: number;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenReport: () => void;
  onOpenItems: () => void;
}

/** RIGHT pane of the Contacts-style master-detail view — header (avatar,
 * contact info, edit/report/delete actions), health/backlog chips + stat
 * tiles, and a compact list of the customer's items/quotations. Reads all
 * numbers via the existing derived.ts helpers (read-only, no logic changes). */
export function CustomerDetailPane({
  customer,
  items,
  health,
  attention,
  onBack,
  onEdit,
  onDelete,
  onOpenReport,
  onOpenItems,
}: CustomerDetailPaneProps) {
  const color = safeHex(customer.color, "#64748b");
  const customerItems = useMemo(
    () => items.filter((item) => item.customerId === customer.id),
    [items, customer.id],
  );
  const revenue = customerRevenue(items, customer.id);
  const progress = customerProgress(items, customer.id);
  const achieved = achievedPercent(items, customer.id);
  const tierMeta = health ? HEALTH_TIER_META[health.tier] : null;
  const hasContactInfo = Boolean(
    customer.contactPerson || customer.phone || customer.email || customer.lineId,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className={`${cardClass} p-5`}>
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-ink lg:hidden"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          กลับไปรายชื่อลูกค้า
        </button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className="grid size-14 shrink-0 place-items-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: color }}
              aria-hidden="true"
            >
              {customerInitial(customer.name)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-ink">{customer.name}</h2>
              <p className="mt-0.5 truncate text-sm text-muted">
                {customer.province || "ไม่ระบุจังหวัด"} · {customer.salesOwner || "ไม่ระบุเจ้าของงานขาย"}
              </p>
              {hasContactInfo ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {customer.contactPerson ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5 text-muted" aria-hidden="true" />
                      {customer.contactPerson}
                    </span>
                  ) : null}
                  {telHref(customer.phone) ? (
                    <a
                      href={telHref(customer.phone)!}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label={`โทร ${customer.phone}`}
                    >
                      <Phone className="size-3.5 text-muted" aria-hidden="true" />
                      {customer.phone}
                    </a>
                  ) : null}
                  {mailtoHref(customer.email) ? (
                    <a
                      href={mailtoHref(customer.email)!}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label={`อีเมล ${customer.email}`}
                    >
                      <Mail className="size-3.5 text-muted" aria-hidden="true" />
                      {customer.email}
                    </a>
                  ) : null}
                  {lineHref(customer.lineId) ? (
                    <a
                      href={lineHref(customer.lineId)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label={`เปิด LINE ${customer.lineId}`}
                    >
                      <MessageCircle className="size-3.5 text-muted" aria-hidden="true" />
                      {customer.lineId}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onEdit}
              aria-label={`แก้ไขลูกค้า ${customer.name}`}
            >
              <Pencil className="size-4" aria-hidden="true" />
              แก้ไข
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={onOpenReport}
              aria-label={`ดูรีพอร์ตของ ${customer.name}`}
            >
              <FileText className="size-4" aria-hidden="true" />
              ดูรีพอร์ต
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              aria-label={`ลบลูกค้า ${customer.name}`}
            >
              {/* Button's ghost variant already sets text/border color via
                  ghostBtnClass, and this repo's Button has no class-merge
                  utility — so the destructive tint is applied directly to
                  these children (which always wins over an ancestor's
                  inherited color) instead of gambling on className order. */}
              <Trash2 className="size-4 text-error-dark" aria-hidden="true" />
              <span className="text-error-dark">ลบ</span>
            </Button>
          </div>
        </div>

        {tierMeta || attention > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {tierMeta ? (
              <Chip tone={tierMeta.tone}>
                {tierMeta.label}
                {health?.reason ? ` · ${health.reason}` : ""}
              </Chip>
            ) : null}
            {attention > 0 ? (
              <Chip tone="warning">
                <TriangleAlert className="size-3.5" aria-hidden="true" />
                {attention.toLocaleString("th-TH")} งานค้าง/ต่ออายุ
              </Chip>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="สรุปตัวเลขลูกค้า">
        <StatTile
          icon={<ClipboardList className="size-4" aria-hidden="true" />}
          tone="primary"
          label="ชิ้นงาน"
          value={customerItems.length.toLocaleString("th-TH")}
        />
        <StatTile
          icon={<Wallet className="size-4" aria-hidden="true" />}
          tone="success"
          label="รายได้รวม"
          value={money(revenue)}
        />
        <StatTile
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          tone="info"
          label="% บรรลุผล"
          value={`${achieved.toLocaleString("th-TH")}%`}
        />
        <StatTile
          icon={<TrendingUp className="size-4" aria-hidden="true" />}
          tone="secondary"
          label="ความคืบหน้า"
          value={`${progress.toLocaleString("th-TH")}%`}
        />
      </section>

      <section className={`${cardClass} flex min-h-0 flex-1 flex-col p-5`} aria-label="ชิ้นงานของลูกค้า">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink">ชิ้นงาน/ใบเสนอราคา</h3>
          {customerItems.length ? (
            <Button type="button" variant="ghost" onClick={onOpenItems}>
              <ClipboardList className="size-4" aria-hidden="true" />
              ดูชิ้นงานทั้งหมด
            </Button>
          ) : null}
        </div>

        {customerItems.length ? (
          <ul className="space-y-2 overflow-y-auto">
            {customerItems.slice(0, MAX_VISIBLE_ITEMS).map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border-soft bg-slate-100/60 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{itemName(item)}</span>
                  <span className="tnum text-sm font-semibold text-ink">{money(item.price)}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <StatusBadges item={item} />
                  {item.qtNo ? <span className="text-xs text-muted">QT: {item.qtNo}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-muted">ยังไม่มีชิ้นงานของลูกค้านี้</p>
        )}

        {customerItems.length > MAX_VISIBLE_ITEMS ? (
          <p className="mt-2 text-center text-xs text-muted">
            และอีก {(customerItems.length - MAX_VISIBLE_ITEMS).toLocaleString("th-TH")} ชิ้นงาน
          </p>
        ) : null}
      </section>
    </div>
  );
}

function customerInitial(name: string) {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
}
