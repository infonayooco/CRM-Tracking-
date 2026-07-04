"use client";

import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Chip, cardClass, emptyCardClass, pageTitleClass } from "@/components/ui";
import { CHANNEL_MAP, EXEC_MAP, THAI_MONTHS_FULL } from "@/lib/constants";
import { filteredItems, isOverdue, itemName } from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { CalDateField, Customer, Item } from "@/lib/types";

const DATE_FIELD_LABELS: Record<CalDateField, string> = {
  publishDate: "Publish Date",
  deadline: "Deadline",
  finishedDate: "Finished Date",
};

const DATE_FIELD_ENTRIES = Object.entries(DATE_FIELD_LABELS) as [CalDateField, string][];

const WEEKDAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."] as const;

export function CalendarView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const settings = useStore((state) => state.settings);
  const filters = useStore((state) => state.filters);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);
  const setCalDateField = useStore((state) => state.setCalDateField);
  const openItemModal = useStore((state) => state.openItemModal);

  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calMode, setCalMode] = useState<"month" | "agenda">("month");

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date();
  const monthLabel = `${THAI_MONTHS_FULL[month]} ${year + 543}`;

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
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
  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);
  const itemsByDate = useMemo(() => groupItemsByDate(visibleItems, calDateField), [visibleItems, calDateField]);
  const noDateItems = useMemo(
    () => visibleItems.filter((item) => !item[calDateField]),
    [visibleItems, calDateField],
  );
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthItemCount = visibleItems.filter((item) => item[calDateField]?.startsWith(monthPrefix)).length;

  const changeMonth = (offset: number) => {
    setCursor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  };
  const goToday = () => {
    const now = new Date();
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600">Calendar</p>
          <h1 className={`mt-1 ${pageTitleClass}`}>
            {calMode === "month" ? monthLabel : "ทั้งหมด"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {calMode === "month" ? (
              <>
                แสดง {monthItemCount.toLocaleString("th-TH")} จาก{" "}
                {visibleItems.length.toLocaleString("th-TH")} ชิ้นงาน
              </>
            ) : (
              <>ทั้งหมด {visibleItems.length.toLocaleString("th-TH")} ชิ้นงาน (เรียงตามวันที่)</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="มุมมองปฏิทิน"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
          >
            {(["month", "agenda"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setCalMode(mode)}
                aria-pressed={calMode === mode}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  calMode === mode ? "bg-brand-600 text-white" : "text-muted hover:bg-slate-100"
                }`}
              >
                {mode === "month" ? "เดือน" : "ทั้งหมด"}
              </button>
            ))}
          </div>
          <div
            role="group"
            aria-label="วันที่ที่ใช้ใน Calendar"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
          >
            {DATE_FIELD_ENTRIES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCalDateField(value)}
                aria-pressed={calDateField === value}
                className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  calDateField === value ? "bg-brand-600 text-white" : "text-muted hover:bg-slate-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {calMode === "month" ? (
            <>
              <button
                type="button"
                onClick={() => changeMonth(-1)}
                className="grid size-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label="เดือนก่อน"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={goToday}
                className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                วันนี้
              </button>
              <button
                type="button"
                onClick={() => changeMonth(1)}
                className="grid size-10 place-items-center rounded-lg border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
                aria-label="เดือนถัดไป"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs font-medium text-muted">
        {Object.values(EXEC_MAP).map((status) => (
          <span key={status.key} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />
            {status.label}
          </span>
        ))}
      </div>

      {calMode === "agenda" ? (
        <AgendaList
          items={visibleItems}
          calDateField={calDateField}
          customerById={customerById}
          onOpen={openItemModal}
        />
      ) : null}

      <div
        className={`overflow-hidden ${cardClass}${calMode === "agenda" ? " hidden" : ""}`}
      >
        <div className="grid grid-cols-7 border-b border-border bg-slate-100 text-center text-xs font-semibold uppercase tracking-wide text-muted">
          {WEEKDAYS.map((weekday, weekdayIndex) => (
            <div
              key={weekday}
              className={`py-2.5 ${weekdayIndex === 0 || weekdayIndex === 6 ? "text-slate-400" : ""}`}
            >
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, index) => {
            const dateKey = day ? dateString(year, month, day) : "";
            const dayItems = day ? itemsByDate.get(dateKey) || [] : [];
            const isCurrentDay =
              day &&
              year === today.getFullYear() &&
              month === today.getMonth() &&
              day === today.getDate();

            return (
              <div
                key={day ? `day-${day}` : `empty-${index}`}
                className={`min-h-28 border-b border-r border-border p-2 sm:min-h-32 ${
                  day
                    ? isCurrentDay
                      ? "bg-brand-50/50 ring-2 ring-inset ring-brand-600"
                      : "bg-surface"
                    : "bg-slate-100/60"
                }`}
              >
                {day ? (
                  <>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span
                        className={
                          isCurrentDay
                            ? "grid size-6 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white"
                            : "text-xs font-semibold text-muted"
                        }
                      >
                        {day.toLocaleString("th-TH")}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {dayItems.slice(0, 4).map((item) => (
                        <CalendarItem
                          key={item.id}
                          item={item}
                          customer={customerById.get(item.customerId)}
                          onOpen={openItemModal}
                        />
                      ))}
                      {dayItems.length > 4 ? (
                        <p className="px-1 text-[11px] font-medium text-muted">
                          +{(dayItems.length - 4).toLocaleString("th-TH")} เพิ่มเติม
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {calMode === "month" && !monthItemCount ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-surface px-4 py-3 text-sm text-muted">
          <CalendarDays className="size-4 text-muted" aria-hidden="true" />
          ไม่มีชิ้นงานในเดือนนี้
        </div>
      ) : null}

      {calMode === "month" ? (
        <NoDateZone
          items={noDateItems}
          customerById={customerById}
          fieldLabel={DATE_FIELD_LABELS[calDateField]}
        />
      ) : null}
    </section>
  );
}

function CalendarItem({
  item,
  customer,
  onOpen,
}: {
  item: Item;
  customer: Customer | undefined;
  onOpen: (id: string) => void;
}) {
  const status = EXEC_MAP[item.execStatus] || EXEC_MAP.not_started;
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  const overdue = isOverdue(item);

  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      title={`${itemName(item)} · ${customer?.name || "ไม่ระบุลูกค้า"}`}
      className={`block w-full cursor-pointer rounded-md border-l-2 px-1.5 py-1 text-left text-[11px] leading-snug transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-300 ${
        overdue ? "border-error bg-error-light text-error-dark" : `border-transparent ${status.badge}`
      }`}
      style={overdue ? undefined : { borderLeftColor: channel.color }}
    >
      <div className="flex min-w-0 items-center gap-1">
        {overdue ? (
          <AlertTriangle className="size-3 shrink-0 text-error" aria-hidden="true" />
        ) : (
          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />
        )}
        <span className="truncate font-semibold">{itemName(item)}</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted">{customer?.name || "ไม่ระบุลูกค้า"}</p>
    </button>
  );
}

function NoDateZone({
  items,
  customerById,
  fieldLabel,
}: {
  items: Item[];
  customerById: Map<string, Customer>;
  fieldLabel: string;
}) {
  return (
    <div className={`${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">
          ไม่มีวันที่ <span className="text-muted">({fieldLabel})</span>
        </h2>
        <Chip tone="muted">{items.length.toLocaleString("th-TH")} ชิ้นงาน</Chip>
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <NoDateItem key={item.id} item={item} customer={customerById.get(item.customerId)} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">ทุกชิ้นงานมี {fieldLabel} แล้ว</p>
      )}
    </div>
  );
}

function NoDateItem({ item, customer }: { item: Item; customer: Customer | undefined }) {
  const status = EXEC_MAP[item.execStatus] || EXEC_MAP.not_started;
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  const overdue = isOverdue(item);

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border-l-2 px-2.5 py-1.5 text-xs ${
        overdue ? "border-error bg-error-light text-error-dark" : `border-transparent ${status.badge}`
      }`}
      style={overdue ? undefined : { borderLeftColor: channel.color }}
      title={`${itemName(item)} · ${customer?.name || "ไม่ระบุลูกค้า"}`}
    >
      {overdue ? (
        <AlertTriangle className="size-3 shrink-0 text-error" aria-hidden="true" />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />
      )}
      <span className="min-w-0 truncate font-semibold">{itemName(item)}</span>
      <span className="min-w-0 truncate text-muted">· {customer?.name || "ไม่ระบุลูกค้า"}</span>
    </span>
  );
}

const AGENDA_DATE_FORMATTER = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatAgendaDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return AGENDA_DATE_FORMATTER.format(new Date(year, month - 1, day));
}

function AgendaList({
  items,
  calDateField,
  customerById,
  onOpen,
}: {
  items: Item[];
  calDateField: CalDateField;
  customerById: Map<string, Customer>;
  onOpen: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const dated = items
      .filter((item) => item[calDateField])
      .sort((a, b) => a[calDateField].localeCompare(b[calDateField]));
    const undated = items.filter((item) => !item[calDateField]);
    const map = new Map<string, Item[]>();
    for (const item of dated) {
      const key = item[calDateField];
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return { dateGroups: [...map.entries()], undated };
  }, [items, calDateField]);

  if (!items.length) {
    return <div className={`${emptyCardClass} text-sm text-muted`}>ไม่มีชิ้นงานตามตัวกรอง</div>;
  }

  return (
    <div className="space-y-4">
      {groups.dateGroups.map(([dateKey, dayItems]) => (
        <div key={dateKey} className={`overflow-hidden ${cardClass}`}>
          <div className="flex items-center justify-between border-b border-border-soft bg-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-ink">{formatAgendaDate(dateKey)}</p>
            <span className="tnum text-xs font-semibold text-muted">
              {dayItems.length.toLocaleString("th-TH")} งาน
            </span>
          </div>
          <ul className="divide-y divide-border-soft">
            {dayItems.map((item) => (
              <AgendaRow
                key={item.id}
                item={item}
                customer={customerById.get(item.customerId)}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </div>
      ))}
      {groups.undated.length ? (
        <div className={`overflow-hidden ${cardClass}`}>
          <div className="border-b border-border-soft bg-slate-100 px-4 py-2.5">
            <p className="text-sm font-semibold text-muted">ไม่มีวันที่</p>
          </div>
          <ul className="divide-y divide-border-soft">
            {groups.undated.map((item) => (
              <AgendaRow
                key={item.id}
                item={item}
                customer={customerById.get(item.customerId)}
                onOpen={onOpen}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function AgendaRow({
  item,
  customer,
  onOpen,
}: {
  item: Item;
  customer: Customer | undefined;
  onOpen: (id: string) => void;
}) {
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  const overdue = isOverdue(item);
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <span
          className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
          style={{ backgroundColor: channel.color }}
        >
          {channel.label}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-ink">{customer?.name || "ไม่ระบุลูกค้า"}</span>
          <span className="text-slate-300"> · </span>
          <span className="text-muted">{itemName(item)}</span>
        </span>
        {overdue ? <AlertTriangle className="size-4 shrink-0 text-error" aria-hidden="true" /> : null}
      </button>
    </li>
  );
}

function buildMonthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];

  for (let index = 0; index < startDow; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7) cells.push(null);

  return cells;
}

function groupItemsByDate(items: Item[], field: CalDateField) {
  const groups = new Map<string, Item[]>();

  items.forEach((item) => {
    const value = item[field];
    if (!value) return;
    const list = groups.get(value) || [];
    list.push(item);
    groups.set(value, list);
  });

  return groups;
}

function dateString(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
