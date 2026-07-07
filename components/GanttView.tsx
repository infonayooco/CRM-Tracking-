"use client";

import { useMemo, useState } from "react";
import { GanttChartSquare } from "lucide-react";
import { GanttChart } from "@/components/charts/apex/GanttChart";
import { DashboardCard, emptyCardClass, pageTitleClass } from "@/components/ui";
import { EXEC_STATUS } from "@/lib/constants";
import { buildGanttRows, filteredItems } from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { CalDateField } from "@/lib/types";

const DATE_FIELD_LABELS: Record<CalDateField, string> = {
  publishDate: "Publish Date",
  deadline: "Deadline",
  finishedDate: "Finished Date",
};
const DATE_FIELD_ENTRIES = Object.entries(DATE_FIELD_LABELS) as [CalDateField, string][];

type GroupByKey = "customer" | "itemType" | "salesOwner";
const GROUP_BY_LABELS: Record<GroupByKey, string> = {
  customer: "ตามลูกค้า",
  itemType: "ตามประเภทงาน",
  salesOwner: "ตามเจ้าของงานขาย",
};
const GROUP_BY_ENTRIES = Object.entries(GROUP_BY_LABELS) as [GroupByKey, string][];

const segmentButtonClass = (active: boolean) =>
  `inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
    active ? "bg-brand-600 text-white" : "text-muted hover:bg-slate-100"
  }`;

export function GanttView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const settings = useStore((state) => state.settings);
  const filters = useStore((state) => state.filters);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);
  const setCalDateField = useStore((state) => state.setCalDateField);

  const [groupBy, setGroupBy] = useState<GroupByKey>("customer");

  // Same selection as ItemsView/CalendarView — respects every active filter
  // (search, customer, channel, status, date range, "งานของฉัน", ฯลฯ).
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

  const rows = useMemo(
    () => buildGanttRows(visibleItems, customers, { groupBy }),
    [visibleItems, customers, groupBy],
  );

  const skippedCount = visibleItems.length - rows.length;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600">Timeline</p>
          <h1 className={`mt-1 ${pageTitleClass}`}>ไทม์ไลน์</h1>
          <p className="mt-1 text-sm text-muted">
            แสดง {rows.length.toLocaleString("th-TH")} จาก {visibleItems.length.toLocaleString("th-TH")}{" "}
            ชิ้นงาน
            {skippedCount > 0 ? (
              <> ({skippedCount.toLocaleString("th-TH")} รายการไม่มีวันที่ที่ใช้แสดงผลได้)</>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="จัดกลุ่มไทม์ไลน์"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
          >
            {GROUP_BY_ENTRIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setGroupBy(value)}
                aria-pressed={groupBy === value}
                className={segmentButtonClass(groupBy === value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            role="group"
            aria-label="วันที่ที่ใช้ในไทม์ไลน์"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
          >
            {DATE_FIELD_ENTRIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCalDateField(value)}
                aria-pressed={calDateField === value}
                className={segmentButtonClass(calDateField === value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length ? (
        <DashboardCard
          title="ไทม์ไลน์ชิ้นงาน"
          subtitle="ช่วงเวลาของแต่ละชิ้นงาน — Publish Date (หรือวันที่สร้าง) ถึง Finished Date/Deadline"
        >
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="text-xs font-medium text-muted">สีแถบ = สถานะการดำเนินการ</span>
            {EXEC_STATUS.map((status) => (
              <span key={status.key} className="inline-flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: status.dot }}
                  aria-hidden="true"
                />
                {status.label}
              </span>
            ))}
          </div>
          <GanttChart rows={rows} />
        </DashboardCard>
      ) : (
        <div className={emptyCardClass}>
          <GanttChartSquare className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-ink">ยังไม่มีชิ้นงานที่แสดงในไทม์ไลน์ได้</p>
          <p className="mt-1 text-sm text-muted">
            เพิ่ม Publish Date หรือ Deadline ให้ชิ้นงาน หรือลองล้างตัวกรองที่ใช้อยู่
          </p>
        </div>
      )}
    </section>
  );
}
