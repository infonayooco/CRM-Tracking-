"use client";

import { format, getDay, parse, startOfWeek } from "date-fns";
import { th } from "date-fns/locale";
import { AlertTriangle, ChevronLeft, ChevronRight, UserRound } from "lucide-react";
import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, Navigate, Views } from "react-big-calendar";
import type { EventPropGetter, Formats, ToolbarProps, View } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./calendarRbc.css";
import { Button, Chip, cardClass, pageTitleClass } from "@/components/ui";
import { CHANNEL_MAP, EXEC_MAP } from "@/lib/constants";
import { filteredItems, isOverdue, itemName } from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { CalDateField, Customer, Item } from "@/lib/types";

const DATE_FIELD_LABELS: Record<CalDateField, string> = {
  publishDate: "Publish Date",
  deadline: "Deadline",
  finishedDate: "Finished Date",
};

const DATE_FIELD_ENTRIES = Object.entries(DATE_FIELD_LABELS) as [CalDateField, string][];

const VIEW_LABELS: Record<View, string> = {
  month: "เดือน",
  week: "สัปดาห์",
  work_week: "สัปดาห์ทำงาน",
  day: "วัน",
  agenda: "ทั้งหมด",
};

const CALENDAR_VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA];

// react-big-calendar's date-fns localizer wiring — Thai month/weekday names via date-fns/locale/th.
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { th },
});

// Header/label formats use Intl("th-TH") instead of the localizer's default so the
// calendar reads the same Buddhist-era year the rest of the app shows (date-fns'
// `th` locale localizes month/day names but keeps the Gregorian year).
const monthYearFormatter = new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" });
const dayHeaderFormatter = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const weekdayShortFormatter = new Intl.DateTimeFormat("th-TH", { weekday: "short" });
const monthDateFormatter = new Intl.DateTimeFormat("th-TH", { day: "numeric" });
const agendaDateFormatter = new Intl.DateTimeFormat("th-TH", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const rangeDayFormatter = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

const calendarFormats: Formats = {
  dateFormat: (date) => monthDateFormatter.format(date),
  weekdayFormat: (date) => weekdayShortFormatter.format(date),
  monthHeaderFormat: (date) => monthYearFormatter.format(date),
  dayHeaderFormat: (date) => dayHeaderFormatter.format(date),
  dayRangeHeaderFormat: ({ start, end }) => `${rangeDayFormatter.format(start)} – ${rangeDayFormatter.format(end)}`,
  agendaHeaderFormat: ({ start, end }) => `${rangeDayFormatter.format(start)} – ${rangeDayFormatter.format(end)}`,
  agendaDateFormat: (date) => agendaDateFormatter.format(date),
};

const CALENDAR_MESSAGES = {
  date: "วันที่",
  time: "เวลา",
  event: "ชิ้นงาน",
  allDay: "ทั้งวัน",
  week: "สัปดาห์",
  work_week: "สัปดาห์ทำงาน",
  day: "วัน",
  month: "เดือน",
  previous: "ก่อนหน้า",
  next: "ถัดไป",
  yesterday: "เมื่อวาน",
  tomorrow: "พรุ่งนี้",
  today: "วันนี้",
  agenda: "ทั้งหมด",
  noEventsInRange: "ไม่มีชิ้นงานตามตัวกรองในช่วงนี้",
  showMore: (count: number) => `+${count.toLocaleString("th-TH")} เพิ่มเติม`,
};

// Mirrors app/globals.css' error tokens. Kept local (not imported) because event
// colors must be applied inline — see the cascade-layer note in calendarRbc.css.
const OVERDUE_TINT = { bg: "#fdede8", text: "#c0392b", accent: "#fa896b" };

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: true;
  item: Item;
  customer: Customer | undefined;
};

// Dates are stored as plain "YYYY-MM-DD" strings; parse them as local-midnight so the
// event lands on the same calendar day regardless of the browser's timezone.
function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

const eventPropGetter: EventPropGetter<CalendarEvent> = (event) => {
  const overdue = isOverdue(event.item);
  const status = EXEC_MAP[event.item.execStatus] || EXEC_MAP.not_started;
  const channel = CHANNEL_MAP[event.item.channel] || CHANNEL_MAP.other;
  const tint = overdue
    ? { bg: OVERDUE_TINT.bg, text: OVERDUE_TINT.text, accent: OVERDUE_TINT.accent }
    : { bg: `${status.dot}1f`, text: status.dot, accent: channel.color };

  return {
    className: "rbc-modernize-event",
    style: {
      backgroundColor: tint.bg,
      color: tint.text,
      borderLeftColor: tint.accent,
    },
  };
};

function CalendarEventContent({ event }: { event: CalendarEvent }) {
  const overdue = isOverdue(event.item);
  const status = EXEC_MAP[event.item.execStatus] || EXEC_MAP.not_started;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {overdue ? (
        <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
      ) : (
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: status.dot }}
          aria-hidden="true"
        />
      )}
      <span className="min-w-0 truncate">{event.title}</span>
    </span>
  );
}

function ModernizeToolbar({ label, view, views, onNavigate, onView }: ToolbarProps<CalendarEvent>) {
  const viewList = Array.isArray(views) ? views : (Object.keys(views) as View[]);

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-border-soft pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => onNavigate(Navigate.TODAY)}>
          วันนี้
        </Button>
        <Button variant="ghost" aria-label="ช่วงก่อนหน้า" onClick={() => onNavigate(Navigate.PREVIOUS)}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="ghost" aria-label="ช่วงถัดไป" onClick={() => onNavigate(Navigate.NEXT)}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <h2 className="text-base font-semibold text-ink sm:text-lg">{label}</h2>
      </div>
      <div
        role="group"
        aria-label="มุมมองปฏิทิน"
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white p-1"
      >
        {viewList.map((viewKey) => (
          <button
            key={viewKey}
            type="button"
            onClick={() => onView(viewKey)}
            aria-pressed={view === viewKey}
            className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
              view === viewKey ? "bg-brand-600 text-white" : "text-muted hover:bg-slate-100"
            }`}
          >
            {VIEW_LABELS[viewKey] ?? viewKey}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CalendarView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const settings = useStore((state) => state.settings);
  const filters = useStore((state) => state.filters);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);
  const setCalDateField = useStore((state) => state.setCalDateField);
  const setFilter = useStore((state) => state.setFilter);
  const openItemModal = useStore((state) => state.openItemModal);

  const mine = filters.mine;

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  // "งานของฉัน" reuses the store's shared filters.mine — the same durable, persisted
  // scope used by the Sidebar toggle and HomeView, so toggling it here stays in sync
  // with the rest of the app instead of drifting into a second local "mine" concept.
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

  const events = useMemo<CalendarEvent[]>(
    () =>
      visibleItems.flatMap((item) => {
        const date = parseCalendarDate(item[calDateField] || "");
        if (!date) return [];
        const customer = customerById.get(item.customerId);
        return [
          {
            id: item.id,
            title: `${itemName(item)} · ${customer?.name || "ไม่ระบุลูกค้า"}`,
            start: date,
            end: date,
            allDay: true as const,
            item,
            customer,
          },
        ];
      }),
    [visibleItems, calDateField, customerById],
  );

  const noDateItems = useMemo(
    () => visibleItems.filter((item) => !item[calDateField]),
    [visibleItems, calDateField],
  );

  const handleSelectEvent = (event: CalendarEvent) => openItemModal(event.item.id);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600">Calendar</p>
          <h1 className={pageTitleClass}>ปฏิทินงาน</h1>
          <p className="mt-1 text-sm text-muted">
            แสดง {visibleItems.length.toLocaleString("th-TH")} ชิ้นงาน
            {mine ? ` · เฉพาะงานของฉัน${settings.currentUser ? ` (${settings.currentUser})` : ""}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
          <button
            type="button"
            onClick={() => setFilter("mine", !mine)}
            aria-pressed={mine}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold transition-colors ${
              mine
                ? "border-brand-600 bg-primary-light text-primary-dark"
                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <UserRound className="size-4" aria-hidden="true" />
            งานของฉัน
          </button>
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

      <div className={`overflow-hidden ${cardClass} p-3 sm:p-4`}>
        <div className="rbc-modernize h-[70vh] min-h-[560px]">
          <Calendar<CalendarEvent>
            localizer={localizer}
            culture="th"
            events={events}
            defaultView={Views.MONTH}
            views={CALENDAR_VIEWS}
            defaultDate={new Date()}
            popup
            style={{ height: "100%" }}
            formats={calendarFormats}
            messages={CALENDAR_MESSAGES}
            eventPropGetter={eventPropGetter}
            onSelectEvent={handleSelectEvent}
            components={{ toolbar: ModernizeToolbar, event: CalendarEventContent }}
          />
        </div>
      </div>

      {noDateItems.length ? (
        <div className={`${cardClass} p-4`}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">
              ไม่มีวันที่ <span className="text-muted">({DATE_FIELD_LABELS[calDateField]})</span>
            </h2>
            <Chip tone="muted">{noDateItems.length.toLocaleString("th-TH")} ชิ้นงาน</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            {noDateItems.map((item) => (
              <NoDateItem
                key={item.id}
                item={item}
                customer={customerById.get(item.customerId)}
                onOpen={openItemModal}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function NoDateItem({
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
      className={`inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-lg border-l-2 px-2.5 py-1.5 text-left text-xs transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-300 ${
        overdue ? "border-error bg-error-light text-error-dark" : `border-transparent ${status.badge}`
      }`}
      style={overdue ? undefined : { borderLeftColor: channel.color }}
    >
      {overdue ? (
        <AlertTriangle className="size-3 shrink-0 text-error" aria-hidden="true" />
      ) : (
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: status.dot }} aria-hidden="true" />
      )}
      <span className="min-w-0 truncate font-semibold">{itemName(item)}</span>
      <span className="min-w-0 truncate text-muted">· {customer?.name || "ไม่ระบุลูกค้า"}</span>
    </button>
  );
}
