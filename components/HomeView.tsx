"use client";

import {
  AlertTriangle,
  BarChart3,
  Check,
  ChevronRight,
  CircleCheck,
  ClockAlert,
  MessageCircle,
  Phone,
  PhoneCall,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { ApexChart } from "@/components/charts/apex/ApexChart";
import { APEX, sparklineOptions } from "@/components/charts/apex/apexTheme";
import { Chip, StatTile, cardClass, pageTitleClass, sectionLabelClass } from "@/components/ui";
import { CHANNEL_MAP } from "@/lib/constants";
import {
  dashboardStats,
  itemName,
  itemsExpired,
  itemsExpiringSoon,
  itemsFollowUpDue,
  itemsNotPublished,
  itemsReportNotSent,
  itemsResultsNotCollected,
  lineHref,
  money,
  parseDate,
  renewalOutcomes,
  revenueMonthOverMonth,
  startOfDay,
  telHref,
} from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { Customer, Item } from "@/lib/types";

const maxVisibleItems = 8;
const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
// Full Thai date (weekday + Buddhist year — "th-TH" resolves the Buddhist
// calendar by default) for the welcome hero.
const heroDateFormatter = new Intl.DateTimeFormat("th-TH", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Modernize semantic tones — rose→error, amber→warning, brand→primary — used
// for section headers/icons/badges/priority-chips throughout this cockpit.
const toneClasses = {
  error: {
    header: "bg-error-light",
    icon: "bg-error-light text-error-dark",
    badge: "bg-error-dark text-white",
    chip: "bg-error-light text-error-dark",
    emphasis: "ring-2 ring-error/40 ring-offset-1",
  },
  warning: {
    header: "bg-warning-light",
    icon: "bg-warning-light text-warning-dark",
    badge: "bg-warning-dark text-white",
    chip: "bg-warning-light text-warning-dark",
    emphasis: "ring-2 ring-warning/40 ring-offset-1",
  },
  primary: {
    header: "bg-primary-light",
    icon: "bg-primary-light text-primary-dark",
    badge: "bg-brand-600 text-white",
    chip: "bg-primary-light text-primary-dark",
    emphasis: "ring-2 ring-brand-300 ring-offset-1",
  },
} as const;

type Tone = keyof typeof toneClasses;
type DateInfo = { label: string; value: string };
// patch can be a fixed value, or a function resolved at click time with "today"
// — needed by the follow-up snooze actions (+1/+3/สัปดาห์หน้า), which must
// compute a NEW future date every time they're clicked, not a fixed one baked
// in when the section list was built.
type QuickActionPatch = Partial<Item> | ((today: Date) => Partial<Item>);
type QuickAction = { label: string; patch: QuickActionPatch; tone?: "positive" | "negative" };
type AttentionSectionConfig = {
  id: string;
  title: string;
  // short label for the header priority chips (#1) and the cleared strip (#5)
  shortLabel: string;
  items: Item[];
  icon: typeof ClockAlert;
  tone: Tone;
  getDateInfo: (item: Item) => DateInfo;
  quickActions?: QuickAction[];
};

export function HomeView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const mine = useStore((state) => state.filters.mine);
  const currentUser = useStore((state) => state.settings.currentUser);
  const setView = useStore((state) => state.setView);
  const openItemModal = useStore((state) => state.openItemModal);
  const updateItem = useStore((state) => state.updateItem);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  // "งานของฉัน" — scope every worklist to the current user's customers. Home
  // previously ignored the mine toggle and showed all four owners' work.
  const scopedItems = useMemo(
    () =>
      mine
        ? items.filter((item) => customerById.get(item.customerId)?.salesOwner === currentUser)
        : items,
    [items, mine, currentUser, customerById],
  );

  const sections = useMemo<AttentionSectionConfig[]>(() => {
    const today = new Date();

    return [
      {
        id: "follow-up",
        title: "ติดตามวันนี้",
        shortLabel: "ติดตาม",
        icon: PhoneCall,
        tone: "primary",
        items: itemsFollowUpDue(scopedItems, today),
        getDateInfo: (item) => ({ label: "ติดตาม", value: item.followUpDate }),
        quickActions: [
          { label: "ติดตามแล้ว", patch: { followUpDate: "" }, tone: "positive" },
          { label: "+1 วัน", patch: (todayNow) => ({ followUpDate: isoDateAfter(todayNow, 1) }) },
          { label: "+3 วัน", patch: (todayNow) => ({ followUpDate: isoDateAfter(todayNow, 3) }) },
          {
            label: "สัปดาห์หน้า",
            patch: (todayNow) => ({ followUpDate: isoDateAfter(todayNow, 7) }),
          },
        ],
      },
      {
        id: "not-published",
        title: "เลยกำหนดเผยแพร่",
        shortLabel: "เลยกำหนด",
        icon: ClockAlert,
        tone: "error",
        items: sortByDate(itemsNotPublished(scopedItems, today), (item) => item.publishDate),
        getDateInfo: (item) => ({ label: "เผยแพร่", value: item.publishDate }),
      },
      {
        id: "results-not-collected",
        title: "ยังไม่เก็บผลลัพธ์",
        shortLabel: "ผลลัพธ์",
        icon: BarChart3,
        tone: "primary",
        items: sortByDate(itemsResultsNotCollected(scopedItems), resultOrPublishDate),
        getDateInfo: (item) => ({
          label: item.finishedDate ? "สิ้นสุด" : "เผยแพร่",
          value: resultOrPublishDate(item),
        }),
      },
      {
        id: "report-not-sent",
        title: "ยังไม่ส่งรีพอร์ต",
        shortLabel: "รีพอร์ต",
        icon: Send,
        tone: "warning",
        items: sortByDate(itemsReportNotSent(scopedItems), resultOrPublishDate),
        getDateInfo: (item) => ({
          label: item.finishedDate ? "สิ้นสุด" : "เผยแพร่",
          value: resultOrPublishDate(item),
        }),
        quickActions: [{ label: "ส่งแล้ว", patch: { reportStatus: "sent" }, tone: "positive" }],
      },
      {
        id: "expiring-soon",
        title: "ใกล้หมดอายุ (30 วัน)",
        shortLabel: "ใกล้หมดอายุ",
        icon: RefreshCw,
        tone: "primary",
        items: sortByDate(itemsExpiringSoon(scopedItems, today), (item) => item.finishedDate),
        getDateInfo: (item) => ({ label: "หมดอายุ", value: item.finishedDate }),
      },
      {
        id: "expired",
        title: "หมดอายุแล้ว — ต่ออายุ",
        shortLabel: "ต่ออายุ",
        icon: AlertTriangle,
        tone: "warning",
        // most-recently expired first = the warmest renewal lead
        items: sortByDate(itemsExpired(scopedItems, today), (item) => item.finishedDate).reverse(),
        getDateInfo: (item) => ({ label: "หมดอายุเมื่อ", value: item.finishedDate }),
        quickActions: [
          { label: "ต่ออายุแล้ว", patch: { renewalStatus: "renewed" }, tone: "positive" },
          { label: "ไม่ต่อ", patch: { renewalStatus: "lost" }, tone: "negative" },
        ],
      },
    ];
  }, [scopedItems]);

  const totalAttention = sections.reduce((sum, section) => sum + section.items.length, 0);

  // Tier 1 = the two genuinely time-urgent buckets (today's follow-ups + overdue
  // publishing); tier 2 = the four continuous/ongoing worklists. Order is
  // preserved from `sections` above (urgent first), so every derived list below
  // (chips, cleared strip) naturally reads urgent-first too.
  const tier1Sections = sections.filter(
    (section) => section.id === "follow-up" || section.id === "not-published",
  );
  const tier2Sections = sections.filter(
    (section) => section.id !== "follow-up" && section.id !== "not-published",
  );
  const tier1NonEmpty = tier1Sections.filter((section) => section.items.length > 0);
  const tier2NonEmpty = tier2Sections.filter((section) => section.items.length > 0);
  const nonEmptySections = sections.filter((section) => section.items.length > 0);
  const clearedSections = sections.filter((section) => section.items.length === 0);

  const now = new Date();
  const greeting = greetingForHour(now.getHours());

  return (
    <section className="space-y-6">
      <div className={`${cardClass} overflow-hidden bg-gradient-to-br from-primary-light to-white p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-white/70 text-primary-dark">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-primary-dark">
                {greeting}
                {currentUser ? ` คุณ${currentUser}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted">{heroDateFormatter.format(now)}</p>
            </div>
          </div>
          <p className="text-sm font-medium text-ink">
            {totalAttention > 0 ? (
              <>
                วันนี้มีงานที่ต้องดำเนินการ{" "}
                <span className="tnum font-bold text-primary-dark">
                  {totalAttention.toLocaleString("th-TH")}
                </span>{" "}
                รายการ
              </>
            ) : (
              "วันนี้ไม่มีงานค้าง ราบรื่นดีมาก!"
            )}
          </p>
        </div>
      </div>

      <header className="space-y-3">
        <div>
          <h1 className={pageTitleClass}>สิ่งที่ต้องทำ</h1>
          <p className="mt-1 text-sm text-muted">งานค้างและโอกาสต่ออายุที่ควรดูวันนี้</p>
          {mine ? (
            <Chip tone="primary" className="mt-2">
              <UserRound className="size-3.5" aria-hidden="true" />
              เฉพาะงานของฉัน{currentUser ? ` · ${currentUser}` : ""}
            </Chip>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="สรุปงานค้างตามหมวด">
          <span className="sr-only">
            รวมงานที่ต้องทำวันนี้ {totalAttention.toLocaleString("th-TH")} รายการ
          </span>
          {nonEmptySections.length ? (
            nonEmptySections.map((section) => {
              const tone = toneClasses[section.tone];
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => {
                    const target = document.getElementById(section.id);
                    target?.scrollIntoView?.({ behavior: "smooth", block: "start" });
                  }}
                  className={`tnum inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-brand-100 focus:ring-offset-1 ${tone.chip}`}
                  aria-label={`ไปที่หมวด ${section.title} มี ${section.items.length.toLocaleString("th-TH")} รายการ`}
                >
                  <span>{section.shortLabel}</span>
                  <span>{section.items.length.toLocaleString("th-TH")}</span>
                </button>
              );
            })
          ) : (
            <Chip tone="success">
              <CircleCheck className="size-3.5" aria-hidden="true" />
              ไม่มีงานค้างวันนี้
            </Chip>
          )}
        </div>
      </header>

      {tier1NonEmpty.length ? (
        <div className="space-y-3">
          <h2 className={sectionLabelClass}>วันนี้ · ต้องทำก่อน</h2>
          <div className="space-y-5">
            {tier1NonEmpty.map((section) => (
              <AttentionSection
                key={section.id}
                section={section}
                urgent
                customerById={customerById}
                onOpenItem={openItemModal}
                onQuickAction={updateItem}
                onViewAll={() => setView("items")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {tier2NonEmpty.length ? (
        <div className="space-y-3">
          <h2 className={sectionLabelClass}>งานต่อเนื่อง</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {tier2NonEmpty.map((section) => (
              <AttentionSection
                key={section.id}
                section={section}
                customerById={customerById}
                onOpenItem={openItemModal}
                onQuickAction={updateItem}
                onViewAll={() => setView("items")}
              />
            ))}
          </div>
        </div>
      ) : null}

      {clearedSections.length ? <ClearedStrip sections={clearedSections} /> : null}

      <div className="space-y-3 border-t border-border-soft pt-6">
        <h2 className={sectionLabelClass}>ภาพรวมธุรกิจเดือนนี้</h2>
        <HomeKpiBand items={scopedItems} customers={customers} />
      </div>
    </section>
  );
}

// Time-of-day Thai greeting for the welcome hero — pure display copy, no
// store/derived logic involved.
function greetingForHour(hour: number) {
  if (hour < 12) return "สวัสดีตอนเช้า";
  if (hour < 17) return "สวัสดีตอนบ่าย";
  return "สวัสดีตอนเย็น";
}

// Compact "all clear" strip replacing the old per-bucket tall empty-state
// cards (#5) — every bucket with zero items collapses into one row of check
// pills instead of six min-h-36 cards.
function ClearedStrip({ sections }: { sections: AttentionSectionConfig[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-dashed border-success/40 bg-success-light px-4 py-3">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-dark">
        <CircleCheck className="size-4" aria-hidden="true" />
        เคลียร์แล้ว
      </span>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-success-dark">
        {sections.map((section) => (
          <span key={section.id} className="inline-flex items-center gap-1">
            <Check className="size-3" aria-hidden="true" />
            {section.shortLabel}
          </span>
        ))}
      </span>
    </div>
  );
}

// Read-only "business health at a glance" band. Respects the current mine-scope
// (items are already scoped by the caller). All numbers come from the tested
// derived helpers — this component only lays them out. Now rendered BELOW the
// worklists (#6) — it's a secondary, lighter-weight summary, not the first
// thing a rep sees. Uses the shared Modernize StatTile widget.
function HomeKpiBand({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const band = useMemo(() => {
    const today = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return {
      stats: dashboardStats(items, customers),
      mom: revenueMonthOverMonth(items, monthKey),
      renewal: renewalOutcomes(items, today),
    };
  }, [items, customers]);

  const { stats, mom, renewal } = band;
  const deltaPct = mom.deltaPct;

  // Same series RevenueByMonth charts (dashboardStats().byMonth, i.e. real
  // publishDate-bucketed revenue) — trimmed to a short recent window since this
  // is a compact sparkline footer, not the full multi-year report chart.
  const monthlySeries = useMemo(
    () => stats.byMonth.slice(-6).map((entry) => entry.value),
    [stats.byMonth],
  );

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-5">
      <RevenueStatTile current={mom.current} deltaPct={deltaPct} monthlySeries={monthlySeries} />
      <StatTile
        icon={<Target className="size-5" aria-hidden="true" />}
        tone="success"
        label="บรรลุผล"
        value={`${stats.achievedPct}%`}
      />
      <StatTile
        icon={<Send className="size-5" aria-hidden="true" />}
        tone="warning"
        label="ส่งรีพอร์ต"
        value={`${stats.reportSentPct}%`}
      />
      <StatTile
        icon={<Star className="size-5" aria-hidden="true" />}
        tone="secondary"
        label={
          stats.ratedCount ? `คะแนนเฉลี่ย · ${stats.ratedCount.toLocaleString("th-TH")} งาน` : "คะแนนเฉลี่ย"
        }
        value={stats.ratedCount ? `⭐ ${stats.avgRating}` : "—"}
      />
      <StatTile
        icon={<RefreshCw className="size-5" aria-hidden="true" />}
        tone="error"
        label={renewal.rate !== null ? `รอต่ออายุ · อัตราต่อ ${renewal.rate}%` : "รอต่ออายุ"}
        value={renewal.pending.toLocaleString("th-TH")}
      />
    </div>
  );
}

// Modernize "hero" metric widget for รายได้เดือนนี้ — same visual shell as
// StatTile (primary icon chip, MoM trend pill, big value + label) with a
// compact ApexCharts sparkline of recent monthly revenue appended below.
// Composed locally (components/ui/* is out of scope) reusing the same
// cardClass/tone tokens StatTile uses, so it still reads as one shared kit.
function RevenueStatTile({
  current,
  deltaPct,
  monthlySeries,
}: {
  current: number;
  deltaPct: number | null;
  monthlySeries: number[];
}) {
  // Need at least 2 points for a trend line to mean anything — with 0-1 months
  // of real publishDate-bucketed revenue, skip the chart rather than fabricate
  // a flat/empty line (mirrors the "no series when there's no data" rule).
  const hasTrend = monthlySeries.length > 1;

  const sparkOptions = useMemo(
    () => ({
      ...sparklineOptions({ type: "area", color: APEX.primary, currency: true }),
      dataLabels: { enabled: false },
    }),
    [],
  );

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex items-center justify-between gap-2">
        <span className="grid size-10 place-items-center rounded-lg bg-primary-light text-primary-dark">
          <Wallet className="size-5" aria-hidden="true" />
        </span>
        {deltaPct === null ? null : (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              deltaPct >= 0 ? "bg-success-light text-success-dark" : "bg-error-light text-error-dark"
            }`}
          >
            <span className="inline-flex items-center gap-0.5">
              {deltaPct >= 0 ? (
                <TrendingUp className="size-3" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3" aria-hidden="true" />
              )}
              {deltaPct >= 0 ? "+" : ""}
              {deltaPct}% MoM
            </span>
          </span>
        )}
      </div>
      <p className="tnum mt-3 text-2xl font-bold text-ink">{money(current)}</p>
      <p className="mt-0.5 text-sm text-muted">รายได้เดือนนี้</p>
      {hasTrend ? (
        <div className="mt-3 h-10">
          <ApexChart
            type="area"
            height="100%"
            className="h-full"
            series={[{ name: "รายได้", data: monthlySeries }]}
            options={sparkOptions}
          />
        </div>
      ) : null}
    </div>
  );
}

function AttentionSection({
  section,
  urgent = false,
  customerById,
  onOpenItem,
  onQuickAction,
  onViewAll,
}: {
  section: AttentionSectionConfig;
  urgent?: boolean;
  customerById: Map<string, Customer>;
  onOpenItem: (id?: string | null) => void;
  onQuickAction: (id: string, patch: Partial<Item>) => void;
  onViewAll: () => void;
}) {
  const Icon = section.icon;
  const tone = toneClasses[section.tone];
  const visibleItems = section.items.slice(0, maxVisibleItems);
  // The follow-up bucket is the only one with a note/call/LINE/snooze act-in-place
  // row (#3) — special-cased by id, same pattern already used by quickActions.
  const showFollowUpExtras = section.id === "follow-up";

  return (
    <section
      id={section.id}
      className={`overflow-hidden ${cardClass} ${urgent ? tone.emphasis : ""}`}
    >
      <header className={`border-b border-border-soft px-5 py-4 ${tone.header}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone.icon}`}>
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="truncate text-base font-semibold text-ink">{section.title}</h2>
          </div>
          <span
            className={`tnum min-w-8 rounded-full px-3 py-1 text-center text-sm font-bold ${tone.badge}`}
          >
            {section.items.length.toLocaleString("th-TH")}
          </span>
        </div>
      </header>

      {visibleItems.length ? (
        <div className="divide-y divide-border-soft">
          {visibleItems.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              customer={customerById.get(item.customerId)}
              dateInfo={section.getDateInfo(item)}
              onOpenItem={onOpenItem}
              quickActions={section.quickActions}
              onQuickAction={onQuickAction}
              useRelativeDate={urgent}
              showFollowUpExtras={showFollowUpExtras}
            />
          ))}
        </div>
      ) : (
        <EmptySection />
      )}

      {section.items.length > maxVisibleItems ? (
        <div className="border-t border-border-soft bg-slate-100 px-5 py-2.5">
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-primary-dark transition-colors duration-150 hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            <span>ดูทั้งหมด</span>
            <span className="tnum">{section.items.length.toLocaleString("th-TH")}</span>
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function AttentionRow({
  item,
  customer,
  dateInfo,
  onOpenItem,
  quickActions,
  onQuickAction,
  useRelativeDate = false,
  showFollowUpExtras = false,
}: {
  item: Item;
  customer: Customer | undefined;
  dateInfo: DateInfo;
  onOpenItem: (id?: string | null) => void;
  quickActions?: QuickAction[];
  onQuickAction: (id: string, patch: Partial<Item>) => void;
  useRelativeDate?: boolean;
  showFollowUpExtras?: boolean;
}) {
  const channel = CHANNEL_MAP[item.channel] || CHANNEL_MAP.other;
  // Differentiator-first, same rule as ItemsView/BoardView: item.detail leads
  // as the bold headline, itemType only fills in when detail is empty, and
  // demotes to a small chip beside the channel badge when both are shown.
  const detail = item.detail.trim();
  const headline = detail || itemName(item);
  const showTypeChip = Boolean(detail && item.itemType.trim());

  // Follow-up act-in-place (#3): why (followUpNote) + tap-to-act (tel/LINE).
  const note = showFollowUpExtras ? item.followUpNote.trim() : "";
  const phoneHref = showFollowUpExtras ? telHref(customer?.phone ?? "") : null;
  const lineHrefValue = showFollowUpExtras ? lineHref(customer?.lineId ?? "") : null;
  const hasContactActions = Boolean(phoneHref || lineHrefValue);

  return (
    <article className="flex flex-col">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onOpenItem(item.id)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-5 py-3 text-left transition-colors duration-150 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-100"
          aria-label={`เปิดรายละเอียด ${headline}`}
        >
          <span
            className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold text-white"
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

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-ink">
              <span className="font-semibold">{headline}</span>
              <span className="text-slate-300"> · </span>
              <span className="text-muted">{customer?.name || "ไม่ระบุลูกค้า"}</span>
            </span>
            <span className="mt-1 block text-xs">
              {useRelativeDate ? (
                <RelativeDateText label={dateInfo.label} value={dateInfo.value} />
              ) : (
                <span className="tnum text-muted">
                  {dateInfo.label} {formatDate(dateInfo.value)}
                </span>
              )}
            </span>
          </span>
        </button>
        {quickActions?.length ? (
          <div className="mr-4 flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {quickActions.map((action) => {
              const isPositive = action.tone === "positive";
              const isNegative = action.tone === "negative";
              const ActionIcon = isNegative ? X : isPositive ? Check : null;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => {
                    const patch =
                      typeof action.patch === "function" ? action.patch(new Date()) : action.patch;
                    onQuickAction(item.id, patch);
                  }}
                  className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-100 ${
                    isPositive
                      ? "border-transparent bg-primary-light text-primary-dark hover:bg-brand-600 hover:text-white"
                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-label={`${action.label}: ${itemName(item)}`}
                >
                  {ActionIcon ? <ActionIcon className="size-3.5" aria-hidden="true" /> : null}
                  {action.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {note ? <p className="line-clamp-2 px-5 pb-2 text-xs text-muted">{note}</p> : null}

      {hasContactActions ? (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          {phoneHref ? (
            <a
              href={phoneHref}
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-primary-light px-2.5 text-xs font-semibold text-primary-dark transition-colors hover:bg-brand-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              aria-label={`โทร ${customer?.phone}: ${itemName(item)}`}
            >
              <Phone className="size-3.5" aria-hidden="true" />
              โทร
            </a>
          ) : null}
          {lineHrefValue ? (
            <a
              href={lineHrefValue}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-primary-light px-2.5 text-xs font-semibold text-primary-dark transition-colors hover:bg-brand-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-100"
              aria-label={`เปิด LINE ${customer?.lineId}: ${itemName(item)}`}
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              LINE
            </a>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

// Urgency-colored relative date (#4) — overdue is rose, today is a small pill,
// upcoming is neutral slate. The absolute date is kept in the title/tooltip so
// nothing is lost, just demoted.
function RelativeDateText({ label, value }: { label: string; value: string }) {
  const date = parseDate(value);
  const absolute = formatDate(value);

  if (!date) {
    return (
      <span className="tnum text-muted" title={`${label} ${absolute}`}>
        {label} {absolute}
      </span>
    );
  }

  const diffDays = Math.round(
    (Number(startOfDay(date)) - Number(startOfDay(new Date()))) / 86400000,
  );

  if (diffDays < 0) {
    return (
      <span className="tnum font-semibold text-error" title={`${label} ${absolute}`}>
        {label} เลย {Math.abs(diffDays)} วัน
      </span>
    );
  }

  if (diffDays === 0) {
    return (
      <span className="inline-flex items-center gap-1" title={`${label} ${absolute}`}>
        <span className="text-muted">{label}</span>
        <span className="rounded-lg bg-primary-light px-1.5 py-0.5 text-[11px] font-semibold text-primary-dark">
          วันนี้
        </span>
      </span>
    );
  }

  return (
    <span className="tnum text-muted" title={`${label} ${absolute}`}>
      {label} อีก {diffDays} วัน
    </span>
  );
}

function EmptySection() {
  return (
    <div className="grid min-h-36 place-items-center px-5 py-10 text-center">
      <div>
        <CircleCheck className="mx-auto size-8 text-success" aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-ink">ไม่มีค้าง - เยี่ยม!</p>
      </div>
    </div>
  );
}

function resultOrPublishDate(item: Item) {
  return item.finishedDate || item.publishDate;
}

function sortByDate(items: Item[], getDateValue: (item: Item) => string) {
  return [...items].sort((a, b) => {
    const aTime = getDateTime(getDateValue(a));
    const bTime = getDateTime(getDateValue(b));
    return aTime - bTime || itemName(a).localeCompare(itemName(b), "th");
  });
}

function getDateTime(value: string) {
  const date = parseDate(value);
  return date ? Number(startOfDay(date)) : Number.MAX_SAFE_INTEGER;
}

function formatDate(value: string) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date) : "ไม่ระบุวันที่";
}

// Snooze target date for the follow-up quick actions (#3) — COMPUTED at click
// time from `today` (never a value baked into the section list), so it stays
// correct no matter how long the worklist has been open.
function isoDateAfter(today: Date, days: number) {
  const date = startOfDay(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}
