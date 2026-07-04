"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  FileSpreadsheet,
  Printer,
  Receipt,
  RefreshCw,
  Send,
  ShoppingBag,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { SalesSummary } from "@/components/SalesSummary";
import {
  Chip,
  DashboardCard,
  StatTile,
  cardClass,
  emptyCardClass,
  ghostBtnClass,
  pageTitleClass,
  primaryBtnClass,
  sectionLabelClass,
  type StatTone,
} from "@/components/ui";
import { ExecStatusBar } from "@/components/charts/ExecStatusBar";
import { ResultStatusBar } from "@/components/charts/ResultStatusBar";
import { RevenueByChannel } from "@/components/charts/RevenueByChannel";
import { RevenueByMonth } from "@/components/charts/RevenueByMonth";
import { RevenueByOwner } from "@/components/charts/RevenueByOwner";
import { TopCustomers } from "@/components/charts/TopCustomers";
import { KpiRadialGauge, KpiRevenueSparkline } from "@/components/report/HeroKpiCharts";
import { RevenueChannelDonut } from "@/components/report/RevenueChannelDonut";
import { THAI_MONTHS_FULL } from "@/lib/constants";
import { serializeAnalyticsCsv } from "@/lib/exportAnalytics";
import { downloadFile } from "@/lib/exportData";
import {
  activeFilterChips,
  attainmentSummary,
  campaignFunnel,
  channelPerformance,
  customerConcentration,
  customerHealth,
  dashboardStats,
  dateFieldCoverage,
  filteredItems,
  hasActiveFilters,
  itemName,
  itemTypePerformance,
  kpiMonthOverMonth,
  money,
  ownerConcentration,
  ownerPerformance,
  prevMonthKey,
  prevYearMonthKey,
  priceIntegrityIssues,
  renewalOutcomes,
  renewalPipeline,
  reportTurnaround,
  revenueBreakdown,
  revenueForecast,
  revenueMonthOverMonth,
  unbilledQuotations,
} from "@/lib/derived";
import type {
  AttainmentSummary,
  CampaignFunnel,
  ChannelPerf,
  CustomerConcentration,
  CustomerHealth,
  ItemTypePerf,
  OwnerConcentration,
  OwnerPerf,
  PriceIntegrityIssues,
  PriceIssueRow,
  RenewalBucket,
  ReportTurnaround,
  RevenueForecast,
  UnbilledQuotation,
  UnbilledSummary,
} from "@/lib/derived";
import { useStore } from "@/lib/store";

const ALL_MONTHS = "all";

type ReportTab = "overview" | "sales";
type KpiTone = "slate" | "brand" | "amber" | "emerald" | "violet";
type KpiDeltaUnit = "count" | "pct" | "rating";
type CompareBasis = "mom" | "yoy";

const COMPARE_BASIS_OPTIONS: { value: CompareBasis; label: string }[] = [
  { value: "mom", label: "เทียบเดือนก่อน" },
  { value: "yoy", label: "เทียบปีก่อน" },
];

// Modernize tinted icon chip per KPI tone — the tile value itself is always
// text-ink (StatTile convention); only the icon chip carries the tone color.
const KPI_TONE_CLASSES: Record<KpiTone, { icon: string }> = {
  slate: { icon: "bg-slate-100 text-slate-600" },
  brand: { icon: "bg-primary-light text-primary" },
  amber: { icon: "bg-warning-light text-warning-dark" },
  emerald: { icon: "bg-success-light text-success-dark" },
  violet: { icon: "bg-secondary-light text-info-dark" },
};

// Supporting KPI tiles render through the shared <StatTile> (@/components/ui)
// instead of the bespoke KpiTile below — same tone *intent* per metric, just
// mapped onto StatTile's own tone vocabulary (which has no neutral "slate").
const KPI_TONE_TO_STAT_TONE: Record<KpiTone, StatTone> = {
  slate: "secondary",
  brand: "primary",
  amber: "warning",
  emerald: "success",
  violet: "secondary",
};

interface KpiConfig {
  label: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  tone: KpiTone;
  delta?: { value: number; unit: KpiDeltaUnit };
  /** Hero-only: a compact ApexCharts sparkline/radial gauge rendered under the value. */
  chart?: ReactNode;
}

export function ReportView() {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("overview");
  const [selectedMonth, setSelectedMonth] = useState(ALL_MONTHS);
  const [compareBasis, setCompareBasis] = useState<CompareBasis>("mom");
  const items = useStore((state) => state.items);
  const customers = useStore((state) => state.customers);
  const filters = useStore((state) => state.filters);
  const settings = useStore((state) => state.settings);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);

  const monthOptions = useMemo(
    () =>
      [...new Set(items.map((item) => publishMonthKey(item.publishDate)).filter(Boolean))]
        .sort((a, b) => b.localeCompare(a))
        .map((month) => ({ value: month, label: formatThaiBuddhistMonth(month) })),
    [items],
  );

  const activeMonth =
    selectedMonth === ALL_MONTHS || monthOptions.some((option) => option.value === selectedMonth)
      ? selectedMonth
      : ALL_MONTHS;

  const monthItems = useMemo(
    () =>
      activeMonth === ALL_MONTHS
        ? items
        : items.filter((item) => publishMonthKey(item.publishDate) === activeMonth),
    [activeMonth, items],
  );
  const scopedItems = useMemo(
    () =>
      filteredItems({
        customers,
        items: monthItems,
        settings,
        filters,
        calDateField,
        statusDim,
      }),
    [calDateField, customers, filters, monthItems, settings, statusDim],
  );
  const allFilteredItems = useMemo(
    () =>
      filteredItems({
        customers,
        items,
        settings,
        filters,
        calDateField,
        statusDim,
      }),
    [calDateField, customers, filters, items, settings, statusDim],
  );
  const stats = useMemo(() => dashboardStats(scopedItems, customers), [scopedItems, customers]);
  const activeFilters = useMemo(
    () =>
      hasActiveFilters({
        customers,
        settings,
        filters,
        statusDim,
      }),
    [customers, filters, settings, statusDim],
  );
  const filterChips = useMemo(
    () =>
      activeFilterChips({
        customers,
        settings,
        filters,
        statusDim,
      }),
    [customers, filters, settings, statusDim],
  );
  // Comparison-basis previous month key — same month a year earlier (YoY) or
  // the immediately preceding month (MoM). Harmless to compute even when
  // activeMonth === ALL_MONTHS (both helpers return "" for a malformed key);
  // revenueMoM/kpiMoM below already null-guard on that case.
  const previousKey =
    compareBasis === "yoy" ? prevYearMonthKey(activeMonth) : prevMonthKey(activeMonth);
  const basisLabel = compareBasis === "yoy" ? "เทียบปีก่อน" : "เทียบเดือนก่อน";
  const revenueMoM = useMemo(
    () =>
      activeMonth === ALL_MONTHS
        ? null
        : revenueMonthOverMonth(allFilteredItems, activeMonth, previousKey),
    [activeMonth, allFilteredItems, previousKey],
  );
  const kpiMoM = useMemo(
    () =>
      activeMonth === ALL_MONTHS
        ? null
        : kpiMonthOverMonth(allFilteredItems, customers, activeMonth, previousKey),
    [activeMonth, allFilteredItems, customers, previousKey],
  );
  const generatedDate = useMemo(
    () =>
      new Date().toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [],
  );
  const monthScope =
    activeMonth === ALL_MONTHS ? "ทุกเดือน" : `เดือน ${formatThaiBuddhistMonth(activeMonth)}`;
  const filterScope = activeFilters
    ? `ตัวกรอง: ${filterChips.map((chip) => chip.label).join(" · ")}`
    : "ทุกตัวกรอง";
  const scopeCaption = `${monthScope} · ${filterScope} · ข้อมูล ณ ${generatedDate}`;

  // Results-headline regroup: the 3 numbers leadership reads first — revenue and
  // the two outcome rates — lead as a larger hero row (each with its existing
  // MoM/YoY delta), with the volume/roster/rating stats as a smaller supporting
  // row underneath. Pure regroup of the same KpiConfig data — no new metrics.
  const heroKpis: KpiConfig[] = [
    {
      label: "รายได้รวม",
      value: money(stats.revenue),
      icon: Wallet,
      tone: "brand",
      delta:
        revenueMoM && revenueMoM.deltaPct !== null
          ? { value: revenueMoM.deltaPct, unit: "pct" }
          : undefined,
      chart: <KpiRevenueSparkline monthly={stats.byMonth} />,
    },
    {
      label: "%บรรลุผล",
      value: `${stats.achievedPct.toLocaleString("th-TH")}%`,
      icon: Target,
      tone: "emerald",
      delta: kpiMoM?.achievedPct.hasPrevious
        ? { value: kpiMoM.achievedPct.delta, unit: "pct" }
        : undefined,
      chart: <KpiRadialGauge value={stats.achievedPct} label="บรรลุผล" tone="success" />,
    },
    {
      label: "%ส่งรีพอร์ต",
      value: `${stats.reportSentPct.toLocaleString("th-TH")}%`,
      icon: Send,
      tone: "violet",
      delta: kpiMoM?.reportSentPct.hasPrevious
        ? { value: kpiMoM.reportSentPct.delta, unit: "pct" }
        : undefined,
      chart: <KpiRadialGauge value={stats.reportSentPct} label="ส่งรีพอร์ต" tone="secondary" />,
    },
  ];

  const supportingKpis: KpiConfig[] = [
    {
      label: "จำนวนชิ้นงาน",
      value: stats.totalItems.toLocaleString("th-TH"),
      icon: ClipboardList,
      tone: "slate",
      delta: kpiMoM?.totalItems.hasPrevious
        ? { value: kpiMoM.totalItems.delta, unit: "count" }
        : undefined,
    },
    {
      label: "จำนวนลูกค้า",
      value: stats.totalCustomers.toLocaleString("th-TH"),
      icon: Users,
      tone: "brand",
      delta: kpiMoM?.totalCustomers.hasPrevious
        ? { value: kpiMoM.totalCustomers.delta, unit: "count" }
        : undefined,
    },
    {
      label: "เฉลี่ย",
      value: stats.ratedCount > 0 ? stats.avgRating : "—",
      subtext:
        stats.ratedCount > 0
          ? `จาก ${stats.ratedCount.toLocaleString("th-TH")} งาน`
          : "ยังไม่มีคะแนน",
      icon: Star,
      tone: "amber",
      // Gate on ratedCount too (BUG 6) — when the tile itself shows "—" (no
      // ratings this month), a MoM delta would be fabricated against a value
      // that isn't actually displayed.
      delta:
        stats.ratedCount > 0 && kpiMoM?.avgRating.hasPrevious
          ? { value: kpiMoM.avgRating.delta, unit: "rating" }
          : undefined,
    },
  ];

  const renewal = useMemo(() => renewalPipeline(allFilteredItems, new Date()), [allFilteredItems]);
  const renewalStats = useMemo(() => renewalOutcomes(allFilteredItems, new Date()), [allFilteredItems]);
  const breakdown = useMemo(() => revenueBreakdown(scopedItems), [scopedItems]);
  // Fed the same (filter-scoped, ALL-MONTHS) list as RenewalPanel's
  // renewalPipeline/renewalOutcomes just above it (BUG 5) — revenueForecast's
  // internal renewal figures must agree with the renewal panel they both derive
  // from, not the month-scoped `scopedItems`.
  const forecast = useMemo(() => revenueForecast(allFilteredItems, new Date()), [allFilteredItems]);
  const channelPerf = useMemo(() => channelPerformance(scopedItems), [scopedItems]);
  const ownerPerf = useMemo(() => ownerPerformance(scopedItems, customers), [scopedItems, customers]);
  const itemTypePerf = useMemo(() => itemTypePerformance(scopedItems), [scopedItems]);
  const attainment = useMemo(() => attainmentSummary(scopedItems), [scopedItems]);
  const reportSla = useMemo(() => reportTurnaround(scopedItems), [scopedItems]);
  const funnel = useMemo(() => campaignFunnel(scopedItems), [scopedItems]);
  const customerHealthRows = useMemo(
    () => customerHealth(scopedItems, customers, new Date()),
    [scopedItems, customers],
  );
  const concentration = useMemo(
    () => ownerConcentration(scopedItems, customers),
    [scopedItems, customers],
  );
  const clientConcentration = useMemo(
    () => customerConcentration(scopedItems, customers),
    [scopedItems, customers],
  );
  const monthCoverage = useMemo(() => dateFieldCoverage(scopedItems, "publishDate"), [scopedItems]);
  const priceIssues = useMemo(
    () => priceIntegrityIssues(scopedItems, customers),
    [scopedItems, customers],
  );
  const unbilled = useMemo(
    () => unbilledQuotations(scopedItems, customers, new Date()),
    [scopedItems, customers],
  );

  return (
    <section className="report-print-root space-y-4">
      <ReportTabs activeTab={activeReportTab} onChange={setActiveReportTab} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-brand-600">Dashboard / Analytics</p>
          <h1 className={`mt-1 text-balance ${pageTitleClass}`}>รายงาน</h1>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="no-print min-w-64 text-sm font-semibold text-muted">
            <span>เดือน Publish</span>
            <span className="relative mt-1 block">
              <CalendarDays
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-600"
                aria-hidden="true"
              />
              <select
                value={activeMonth}
                onChange={(event) => setSelectedMonth(event.target.value)}
                className="tnum h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm font-medium text-ink shadow-sm outline-none transition-colors duration-150 hover:border-brand-600 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
              >
                <option value={ALL_MONTHS}>ทุกเดือน</option>
                {monthOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
            </span>
          </label>
          <CompareBasisToggle
            value={compareBasis}
            onChange={setCompareBasis}
            disabled={activeMonth === ALL_MONTHS}
          />
          <button
            type="button"
            onClick={() =>
              downloadFile(
                "crm-analytics.csv",
                serializeAnalyticsCsv(scopedItems, customers, new Date()),
                "text/csv;charset=utf-8",
              )
            }
            aria-label="ส่งออกตารางวิเคราะห์ที่กำลังแสดงอยู่เป็นไฟล์ CSV"
            className={`no-print ${ghostBtnClass}`}
          >
            <FileSpreadsheet className="size-4" aria-hidden="true" />
            ส่งออกวิเคราะห์ (CSV)
          </button>
          <button type="button" onClick={() => window.print()} className={`no-print ${primaryBtnClass}`}>
            <Printer className="size-4" aria-hidden="true" />
            พิมพ์ / บันทึก PDF
          </button>
        </div>
      </div>

      <section className={`report-header ${cardClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">รายได้รวม</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-4xl font-bold tracking-normal text-ink sm:text-5xl">
                {money(stats.revenue)}
              </p>
              {revenueMoM ? (
                <RevenueDelta
                  deltaPct={revenueMoM.deltaPct}
                  previousMonthLabel={formatThaiBuddhistMonth(previousKey)}
                />
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <RevenueChip label="วางบิลแล้ว (INV)" value={money(breakdown.invoiced)} tone="success" />
              <RevenueChip label="เสนอราคา (QO)" value={money(breakdown.quoted)} tone="warning" />
              <RevenueChip label="หลังหัก VAT 7%" value={money(breakdown.netOfVat)} tone="muted" />
            </div>
            <p className="mt-3 text-sm text-muted">{scopeCaption}</p>
          </div>
        </div>
      </section>

      {activeReportTab === "overview" ? (
        <>
          {/* METRIC WIDGET ROW — hero KPIs (revenue sparkline + attainment/report-sent
              radial gauges) lead as bigger tiles; roster/rating stats follow as
              shared <StatTile> widgets underneath. */}
          <div className="report-kpi-grid space-y-4 lg:space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-6">
              {heroKpis.map((kpi) => (
                <KpiTile key={kpi.label} {...kpi} basisLabel={basisLabel} size="hero" />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
              {supportingKpis.map((kpi) => (
                <StatTile
                  key={kpi.label}
                  className="report-kpi-tile"
                  icon={<kpi.icon className="size-5" aria-hidden="true" />}
                  tone={KPI_TONE_TO_STAT_TONE[kpi.tone]}
                  label={statTileLabel(kpi.label, kpi.subtext)}
                  value={kpi.value}
                  trend={kpiTrend(kpi.delta)}
                />
              ))}
            </div>
          </div>

          {/* HERO ROW + STATUS ROW stay always-visible — Modernize dashboards
              never hide their headline charts behind an accordion. Only the
              deeper breakdown/detail sections below are collapsible. */}
          {scopedItems.length === 0 ? (
            <EmptyScopedState />
          ) : (
            <>
              <div className="report-chart-grid grid gap-4 lg:grid-cols-3 lg:gap-6">
                <ChartCard
                  title="รายได้ตามเดือน Publish"
                  description={`รวมราคาแยกเดือน · ครอบคลุม ${monthCoverage.withDate.toLocaleString("th-TH")}/${monthCoverage.total.toLocaleString("th-TH")} งานที่มี Publish Date`}
                  className="lg:col-span-2 report-chart-hero"
                >
                  <RevenueByMonth items={scopedItems} customers={customers} />
                </ChartCard>
                <ChartCard title="สัดส่วนรายได้ตามช่องทาง" description="ส่วนแบ่งรายได้ของแต่ละช่องทาง">
                  <RevenueChannelDonut items={scopedItems} customers={customers} />
                </ChartCard>
              </div>

              <div className="report-chart-grid grid gap-4 lg:grid-cols-2 lg:gap-6">
                <ChartCard title="การดำเนินการ" description="จำนวนชิ้นงานตามสถานะ (เรียงตามลำดับขั้นตอน)">
                  <ExecStatusBar items={scopedItems} customers={customers} />
                </ChartCard>
                <ChartCard title="ผลลัพธ์" description="จำนวนชิ้นงานตามผลลัพธ์ (เรียงตามลำดับขั้นตอน)">
                  <ResultStatusBar items={scopedItems} customers={customers} />
                </ChartCard>
              </div>
            </>
          )}

          {/* BREAKDOWN GRID — funnel full-width, then channel/owner/itemType/
              attainment/SLA panels re-gridded 2-up (chart beside its compact
              table for channel + owner) instead of stacked one-per-row. */}
          <ReportSection title="ประสิทธิภาพงาน">
            <CampaignFunnelPanel funnel={funnel} />
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
              <ChannelPerformancePanel rows={channelPerf} />
              <ChartCard title="รายได้ตามช่องทาง" description="รวมราคาแยกช่องทาง">
                <RevenueByChannel items={scopedItems} customers={customers} />
              </ChartCard>
              <OwnerPerformancePanel rows={ownerPerf} scopeIsSingleMonth={activeMonth !== ALL_MONTHS} />
              <ChartCard title="รายได้ตามเจ้าของงานขาย" description="รวมราคาแยกเจ้าของงานขาย">
                <RevenueByOwner items={scopedItems} customers={customers} />
              </ChartCard>
              <ItemTypePerformancePanel rows={itemTypePerf} />
              <AttainmentPanel summary={attainment} />
              <div className="lg:col-span-2">
                <ReportSlaPanel turnaround={reportSla} />
              </div>
            </div>
          </ReportSection>

          <ReportSection title="การต่ออายุ & สุขภาพลูกค้า" defaultOpen={false}>
            <OwnerConcentrationBanner concentration={concentration} />
            <CustomerConcentrationBanner concentration={clientConcentration} />
            <ChartCard title="Top 10 ลูกค้าตามรายได้" description="เรียงจากรายได้สูงสุด">
              <TopCustomers items={scopedItems} customers={customers} />
            </ChartCard>
            <RenewalPanel renewal={renewal} outcomes={renewalStats} />
            <CustomerHealthPanel rows={customerHealthRows} />
          </ReportSection>

          <ReportSection title="การเงิน & รายได้" defaultOpen={false}>
            <ForecastPanel forecast={forecast} />
            <PriceIntegrityPanel issues={priceIssues} />
            <UnbilledQuotationsPanel summary={unbilled} />
          </ReportSection>
        </>
      ) : (
        <SalesSummary items={scopedItems} customers={customers} />
      )}
    </section>
  );
}

function ReportTabs({
  activeTab,
  onChange,
}: {
  activeTab: ReportTab;
  onChange: (tab: ReportTab) => void;
}) {
  return (
    <div
      className="no-print inline-flex rounded-lg border border-border-soft bg-slate-100 p-1 shadow-sm"
      role="tablist"
      aria-label="เลือกประเภทรายงาน"
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "overview"}
        onClick={() => onChange("overview")}
        className={reportTabClass(activeTab === "overview")}
      >
        <BarChart3 className="size-4" aria-hidden="true" />
        ภาพรวม
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={activeTab === "sales"}
        onClick={() => onChange("sales")}
        className={reportTabClass(activeTab === "sales")}
      >
        <ShoppingBag className="size-4" aria-hidden="true" />
        ยอดขาย
      </button>
    </div>
  );
}

function reportTabClass(active: boolean) {
  return `inline-flex h-9 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
    active ? "bg-white text-brand-700 shadow-sm ring-1 ring-border-soft" : "text-muted hover:text-ink"
  }`;
}

// Comparison-basis toggle — switches what every report delta (KPI tiles +
// revenue header) compares the active month against. Only meaningful when a
// single month is selected (a "ทุกเดือน" scope has no single previous period
// to compare to), so it's disabled rather than hidden — keeps the header
// layout stable when the user flips back to "ทุกเดือน".
function CompareBasisToggle({
  value,
  onChange,
  disabled,
}: {
  value: CompareBasis;
  onChange: (basis: CompareBasis) => void;
  disabled: boolean;
}) {
  return (
    <div className="no-print flex flex-col gap-1">
      <span className="text-sm font-semibold text-muted">เทียบกับ</span>
      <div
        role="group"
        aria-label="เทียบผลลัพธ์รายงานกับช่วงเวลาใด"
        className={`inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white p-1 shadow-sm ${
          disabled ? "opacity-50" : ""
        }`}
      >
        {COMPARE_BASIS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            title={disabled ? "เลือกเดือนที่ต้องการเปรียบเทียบก่อน" : undefined}
            className={`inline-flex h-8 items-center rounded-md px-2.5 text-xs font-semibold transition-colors ${
              value === option.value ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:bg-slate-100"
            } ${disabled ? "cursor-not-allowed hover:bg-transparent" : "cursor-pointer"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RevenueDelta({
  deltaPct,
  previousMonthLabel,
}: {
  deltaPct: number | null;
  previousMonthLabel: string;
}) {
  if (deltaPct === null) {
    return (
      <span className="inline-flex min-h-8 items-center rounded-full bg-slate-100 px-3 text-sm font-semibold text-muted">
        เดือนก่อนไม่มีรายได้
      </span>
    );
  }

  const isUp = deltaPct >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  const toneClass = isUp ? "bg-success-light text-success-dark" : "bg-error-light text-error-dark";
  const sign = deltaPct >= 0 ? "+" : "";

  return (
    <span
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${toneClass}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span>
        {sign}
        {deltaPct.toLocaleString("th-TH")}% · เทียบ {previousMonthLabel}
      </span>
    </span>
  );
}

// Modernize StatTile aesthetic: tinted icon chip + trend pill up top, big
// text-ink value, muted label below — kept as a plain function (not the
// shared <StatTile>) only because it also carries an optional subtext line, a
// basis caption under the delta pill, and (hero-only) a compact ApexCharts
// sparkline/radial gauge footer.
function KpiTile({
  label,
  value,
  subtext,
  icon: Icon,
  tone,
  delta,
  chart,
  basisLabel,
  size = "supporting",
}: KpiConfig & { basisLabel: string; size?: "hero" | "supporting" }) {
  const toneClasses = KPI_TONE_CLASSES[tone];
  const isHero = size === "hero";
  return (
    <div className={`report-kpi-tile ${cardClass} ${isHero ? "p-4 sm:p-5" : "p-3 sm:p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`grid shrink-0 place-items-center rounded-lg ${toneClasses.icon} ${
            isHero ? "size-10" : "size-8"
          }`}
        >
          <Icon className={isHero ? "size-5" : "size-4"} aria-hidden="true" />
        </span>
        {delta ? <KpiDeltaPill value={delta.value} unit={delta.unit} /> : null}
      </div>
      <p
        className={`tnum truncate font-bold text-ink ${
          isHero ? "mt-3 text-2xl sm:text-3xl" : "mt-2 text-xl sm:text-2xl"
        }`}
      >
        {value}
      </p>
      <p
        className={`truncate font-semibold text-muted ${
          isHero ? "mt-0.5 text-sm sm:text-base" : "mt-0.5 text-xs sm:text-sm"
        }`}
      >
        {label}
      </p>
      {subtext ? <p className="tnum mt-0.5 truncate text-xs text-muted">{subtext}</p> : null}
      {delta ? <p className="tnum mt-1 truncate text-xs text-muted">{basisLabel}</p> : null}
      {chart}
    </div>
  );
}

// Shared sign+magnitude+suffix formatting for a KPI delta — used by both the
// hero tiles' standalone KpiDeltaPill and the supporting tiles' StatTile
// `trend` text (via kpiTrend below), so the two never drift apart.
function formatKpiDelta(value: number, unit: KpiDeltaUnit) {
  const sign = value > 0 ? "+" : "";
  const magnitude =
    unit === "rating"
      ? value.toLocaleString("th-TH", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : value.toLocaleString("th-TH");
  const suffix = unit === "pct" ? "pp" : "";
  return `${sign}${magnitude}${suffix}`;
}

// Supporting KPI tiles render through the shared <StatTile>, whose `trend`
// prop only distinguishes up/down (no neutral tone) — mirrors the `isUp`
// (>= 0) convention already used by RevenueDelta above.
function kpiTrend(delta?: { value: number; unit: KpiDeltaUnit }): { dir: "up" | "down"; text: ReactNode } | undefined {
  if (!delta) return undefined;
  return {
    dir: delta.value >= 0 ? "up" : "down",
    text: <span className="tnum">{formatKpiDelta(delta.value, delta.unit)}</span>,
  };
}

// StatTile's `label` is a single ReactNode slot — fold the KPI's optional
// subtext (e.g. "จาก N งาน") into it as a second line instead of dropping it.
function statTileLabel(label: string, subtext?: string): ReactNode {
  if (!subtext) return label;
  return (
    <>
      <span className="block">{label}</span>
      <span className="tnum block text-xs">{subtext}</span>
    </>
  );
}

function KpiDeltaPill({ value, unit }: { value: number; unit: KpiDeltaUnit }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isDown ? TrendingDown : TrendingUp;
  const toneClass = isUp
    ? "bg-success-light text-success-dark"
    : isDown
      ? "bg-error-light text-error-dark"
      : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`tnum inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${toneClass}`}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {formatKpiDelta(value, unit)}
    </span>
  );
}

function ReportSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className={`report-section group ${cardClass}`}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className={sectionLabelClass}>{title}</span>
        <ChevronDown
          className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 border-t border-border px-4 pb-4 pt-4">{children}</div>
    </details>
  );
}

function OwnerConcentrationBanner({ concentration }: { concentration: OwnerConcentration }) {
  if (concentration.ownerCount <= 1 || concentration.topPct < 60 || !concentration.topOwner) {
    return null;
  }
  const severe = concentration.topPct >= 80;
  const tone = severe
    ? "border-error-light bg-error-light text-error-dark"
    : "border-warning-light bg-warning-light text-warning-dark";
  const iconTone = severe ? "text-error-dark" : "text-warning-dark";
  return (
    <section className={`report-panel flex items-start gap-3 rounded-xl border p-4 shadow-card ${tone}`}>
      <AlertTriangle className={`size-5 shrink-0 ${iconTone}`} aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          ความเสี่ยงกระจุกตัว (key-person): {concentration.topOwner} ถือ {concentration.topPct}% ของงาน
        </p>
        <p className="tnum mt-0.5">
          {concentration.topCount.toLocaleString("th-TH")}/
          {concentration.total.toLocaleString("th-TH")} ชิ้นงาน · {money(concentration.topRevenue)}{" "}
          ผูกกับคนเดียว — ควรกระจายงาน/วางแผนสำรอง
        </p>
      </div>
    </section>
  );
}

// Client-dependency threshold — top-3 customer revenue share at/above this is
// flagged as high concentration risk (unlike OwnerConcentrationBanner, this
// banner still renders below the threshold, just in a neutral tone, since
// "who are our top customers" is worth showing even when it isn't risky yet).
const CLIENT_CONCENTRATION_WARN = 60;

function CustomerConcentrationBanner({ concentration }: { concentration: CustomerConcentration }) {
  if (concentration.total === 0 || concentration.customerCount === 0) {
    return null;
  }
  const warn = concentration.top3Pct >= CLIENT_CONCENTRATION_WARN;
  const tone = warn
    ? "border-warning-light bg-warning-light text-warning-dark"
    : "border-border-soft bg-slate-100 text-ink";
  const Icon = warn ? AlertTriangle : Users;
  const iconTone = warn ? "text-warning-dark" : "text-muted";
  return (
    <section className={`report-panel flex items-start gap-3 rounded-xl border p-4 shadow-card ${tone}`}>
      <Icon className={`size-5 shrink-0 ${iconTone}`} aria-hidden="true" />
      <div className="min-w-0 text-sm">
        <p className="font-semibold">
          ลูกค้า 3 รายแรกคิดเป็น {concentration.top3Pct}% ของรายได้ · รายใหญ่สุด {concentration.topName}{" "}
          {concentration.topPct}%
        </p>
        <p className="tnum mt-0.5">
          {money(concentration.topRevenue)} จากลูกค้า {concentration.customerCount.toLocaleString("th-TH")}{" "}
          ราย{warn ? " — ควรกระจายฐานลูกค้าเพื่อลดความเสี่ยง" : ""}
        </p>
      </div>
    </section>
  );
}

// Funnel stages are ordinal (a fixed pipeline position, not independent
// categories), so they take a single-hue ramp — light for the earliest stage,
// darker as work gets further along — instead of a different color per stage.
// brand-300→600, the app's own Modernize periwinkle hue (matches the literal
// --color-brand-300..600 theme tokens in app/globals.css).
const FUNNEL_STAGE_COLOR: Record<string, string> = {
  published: "#94abff", // brand-300
  collected: "#7a97ff", // brand-400
  achieved: "#6e93ff", // brand-500
  reported: "#5d87ff", // brand-600
};

function CampaignFunnelPanel({ funnel }: { funnel: CampaignFunnel }) {
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">ช่องทางการผลิตงาน (Funnel)</h2>
        <p className="text-xs text-muted">ของงานที่เผยแพร่แล้ว — ดูว่างานตกหล่นที่ขั้นไหน</p>
      </div>
      {funnel.base === 0 ? (
        <p className="rounded-lg bg-slate-100 px-3 py-6 text-center text-sm text-muted">
          ยังไม่มีงานที่เผยแพร่
        </p>
      ) : (
        <div className="space-y-3">
          {funnel.stages.map((stage) => (
            <div key={stage.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-ink">{stage.label}</span>
                <span className="tnum text-xs text-muted">
                  {stage.count.toLocaleString("th-TH")} งาน ·{" "}
                  {stage.pct === null ? "—" : `${stage.pct}%`}
                </span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stage.pct ?? 0}%`,
                    backgroundColor: FUNNEL_STAGE_COLOR[stage.key] ?? "#5d87ff",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ChannelPerformancePanel({ rows }: { rows: ChannelPerf[] }) {
  if (!rows.length) return null;
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">ประสิทธิภาพตามช่องทาง</h2>
        <p className="text-xs text-muted">ไม่ใช่แค่จำนวน — ดู %บรรลุผล · %ส่งรีพอร์ต · คะแนนเฉลี่ย</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted">
              <th className="py-2 pr-3 text-left">ช่องทาง</th>
              <th className="px-3 py-2 text-right">ชิ้นงาน</th>
              <th className="px-3 py-2 text-right">%บรรลุผล</th>
              <th className="px-3 py-2 text-right">%ส่งรีพอร์ต</th>
              <th className="py-2 pl-3 text-right">คะแนนเฉลี่ย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.key}>
                <td className="py-2.5 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    <span className="font-semibold text-ink">{row.label}</span>
                  </span>
                </td>
                <td className="tnum px-3 py-2.5 text-right text-ink">
                  {row.count.toLocaleString("th-TH")}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                  {row.achievedPct}%
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                  {row.reportSentPct}%
                </td>
                <td className="tnum py-2.5 pl-3 text-right text-ink">
                  {row.ratedCount > 0
                    ? `⭐ ${row.avgRating.toFixed(1)} · ${row.ratedCount.toLocaleString("th-TH")}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AttainmentPanel({ summary }: { summary: AttainmentSummary }) {
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">ผลเทียบเป้าหมาย (ตัวเลข)</h2>
          <p className="text-xs text-muted">เป้าหมายเทียบผลจริง แยกตามตัวชี้วัด — ไม่รวมข้ามหน่วย</p>
        </div>
        <span className="tnum text-xs font-medium text-muted">
          ข้อมูล {summary.measured.toLocaleString("th-TH")}/{summary.total.toLocaleString("th-TH")} งานมีตัวเลข
        </span>
      </div>
      {summary.groups.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="py-2 pr-3 text-left">ตัวชี้วัด</th>
                <th className="px-3 py-2 text-right">งาน</th>
                <th className="px-3 py-2 text-right">เป้าหมาย</th>
                <th className="px-3 py-2 text-right">ผลจริง</th>
                <th className="py-2 pl-3 text-right">%บรรลุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.groups.map((group) => (
                <tr key={group.label}>
                  <td className="py-2.5 pr-3 font-semibold text-ink">{group.label}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {group.count.toLocaleString("th-TH")}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {group.totalTarget.toLocaleString("th-TH")}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {group.totalActual.toLocaleString("th-TH")}
                  </td>
                  <td className="tnum py-2.5 pl-3 text-right font-semibold">
                    {group.attainmentPct === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span
                        className={group.attainmentPct >= 100 ? "text-success-dark" : "text-warning-dark"}
                      >
                        {group.attainmentPct}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-100 px-3 py-6 text-center text-sm text-muted">
          ยังไม่มีงานที่กรอกตัวเลขเป้าหมาย/ผลจริง — เพิ่มตัวชี้วัดในชิ้นงานเพื่อดูผลรวม
        </p>
      )}
    </section>
  );
}

const REPORT_SLA_TILE_TONE = {
  slate: { border: "border-border-soft bg-slate-100", value: "text-ink" },
  emerald: { border: "border-success-light bg-success-light", value: "text-success-dark" },
  rose: { border: "border-error-light bg-error-light", value: "text-error-dark" },
} as const;

function ReportSlaPanel({ turnaround }: { turnaround: ReportTurnaround }) {
  const { measured, total, avgDays, medianDays, withinSlaPct, breachingCount, slaDays } = turnaround;

  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink">SLA ส่งรีพอร์ต (turnaround)</h2>
          <p className="text-xs text-muted">
            ระยะเวลาจากวันสิ้นสุดแคมเปญถึงวันที่ส่งรีพอร์ต — ไม่ใช่แค่ส่งแล้วหรือยัง
          </p>
        </div>
        <span className="tnum text-xs font-medium text-muted">
          ข้อมูล {measured.toLocaleString("th-TH")}/{total.toLocaleString("th-TH")} งานมีวันที่ส่งรีพอร์ต
        </span>
      </div>
      {measured === 0 ? (
        <p className="rounded-lg bg-slate-100 px-3 py-6 text-center text-sm text-muted">
          ยังไม่มีข้อมูลวันส่งรีพอร์ต — เริ่มบันทึกเมื่อกดส่งรีพอร์ต
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <ReportSlaTile
            label="เฉลี่ย"
            value={avgDays === null ? "—" : `${avgDays} วัน`}
            tone="slate"
          />
          <ReportSlaTile
            label="มัธยฐาน"
            value={medianDays === null ? "—" : `${medianDays} วัน`}
            tone="slate"
          />
          <ReportSlaTile
            label={`ตรงเวลา (≤${slaDays} วัน)`}
            value={withinSlaPct === null ? "—" : `${withinSlaPct}%`}
            tone={withinSlaPct !== null && withinSlaPct >= 80 ? "emerald" : "slate"}
          />
          <ReportSlaTile
            label="เกิน SLA"
            value={`${breachingCount.toLocaleString("th-TH")} งาน`}
            tone={breachingCount > 0 ? "rose" : "slate"}
          />
        </div>
      )}
    </section>
  );
}

function ReportSlaTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: keyof typeof REPORT_SLA_TILE_TONE;
}) {
  const toneClass = REPORT_SLA_TILE_TONE[tone];
  return (
    <div className={`rounded-lg border p-3 ${toneClass.border}`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`tnum mt-1.5 text-xl font-bold ${toneClass.value}`}>{value}</p>
    </div>
  );
}

function CustomerHealthPanel({ rows }: { rows: CustomerHealth[] }) {
  const riskRows = rows
    .filter((row) => row.tier !== "healthy")
    .sort((a, b) => b.revenueAtRisk - a.revenueAtRisk || b.revenue - a.revenue);

  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">สุขภาพบัญชีลูกค้า / ความเสี่ยงเสียลูกค้า</h2>
        <p className="text-xs text-muted">
          บัญชีที่ควรจับตา เรียงตามรายได้ที่เสี่ยงสูญเสียก่อน — ไม่ใช่แค่ขนาดรายได้รวม
        </p>
      </div>
      {riskRows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold text-muted">
                <th className="py-2 pr-3 text-left">ลูกค้า</th>
                <th className="px-3 py-2 text-left">ระดับความเสี่ยง</th>
                <th className="px-3 py-2 text-left">เหตุผล</th>
                <th className="px-3 py-2 text-right">รายได้เสี่ยง</th>
                <th className="px-3 py-2 text-right">รายได้รวม</th>
                <th className="py-2 pl-3 text-right">%บรรลุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {riskRows.map((row) => (
                <tr key={row.customerId}>
                  <td className="py-2.5 pr-3 font-semibold text-ink">{row.name}</td>
                  <td className="px-3 py-2.5">
                    <CustomerHealthTierBadge tier={row.tier} />
                  </td>
                  <td className="px-3 py-2.5 text-muted">{row.reason}</td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-error-dark">
                    {money(row.revenueAtRisk)}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">{money(row.revenue)}</td>
                  <td className="tnum py-2.5 pl-3 text-right text-ink">
                    {row.achievedPct === null ? <span className="text-muted">—</span> : `${row.achievedPct}%`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-lg bg-success-light px-3 py-6 text-center text-sm font-semibold text-success-dark">
          ทุกบัญชีแข็งแรง — ไม่มีความเสี่ยง
        </p>
      )}
    </section>
  );
}

function CustomerHealthTierBadge({ tier }: { tier: CustomerHealth["tier"] }) {
  const config =
    tier === "at-risk" ? { label: "เสี่ยงสูง", tone: "error" as const } : { label: "จับตา", tone: "warning" as const };
  return <Chip tone={config.tone}>{config.label}</Chip>;
}

function ItemTypePerformancePanel({ rows }: { rows: ItemTypePerf[] }) {
  if (!rows.length) return null;
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">ผลงานตามประเภทงาน</h2>
        <p className="text-xs text-muted">ฟอร์แมตไหนได้ผล — ไม่ใช่แค่จำนวน: %บรรลุผล · %ส่งรีพอร์ต · คะแนนเฉลี่ย</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted">
              <th className="py-2 pr-3 text-left">ประเภทงาน</th>
              <th className="px-3 py-2 text-right">ชิ้นงาน</th>
              <th className="px-3 py-2 text-right">%บรรลุผล</th>
              <th className="px-3 py-2 text-right">%ส่งรีพอร์ต</th>
              <th className="py-2 pl-3 text-right">คะแนนเฉลี่ย</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.itemType}>
                <td className="py-2.5 pr-3 font-semibold text-ink">{row.itemType}</td>
                <td className="tnum px-3 py-2.5 text-right text-ink">
                  {row.count.toLocaleString("th-TH")}
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                  {row.achievedPct}%
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                  {row.reportSentPct}%
                </td>
                <td className="tnum py-2.5 pl-3 text-right text-ink">
                  {row.ratedCount > 0
                    ? `⭐ ${row.avgRating.toFixed(1)} · ${row.ratedCount.toLocaleString("th-TH")}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function OwnerPerformancePanel({
  rows,
  scopeIsSingleMonth,
}: {
  rows: OwnerPerf[];
  scopeIsSingleMonth: boolean;
}) {
  const ownerQuotas = useStore((state) => state.ownerQuotas);
  const setOwnerQuota = useStore((state) => state.setOwnerQuota);
  if (!rows.length) return null;
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">ผลงานตามเจ้าของงานขาย</h2>
        <p className="text-xs text-muted">ใครกำลังทำได้ดี — รายได้ · %บรรลุผล · %ส่งรีพอร์ต · คะแนน · อัตราต่ออายุ</p>
        <p className="text-xs text-muted">เทียบรายได้ตามช่วงที่เลือกกับเป้าหมายที่ตั้งไว้</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[58rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted">
              <th className="py-2 pr-3 text-left">เจ้าของงานขาย</th>
              <th className="px-3 py-2 text-right">ชิ้นงาน</th>
              <th className="px-3 py-2 text-right">รายได้</th>
              <th className="px-3 py-2 text-right">เป้าหมาย (quota)</th>
              <th className="px-3 py-2 text-right">%บรรลุเป้า</th>
              <th className="px-3 py-2 text-right">%บรรลุผล</th>
              <th className="px-3 py-2 text-right">%ส่งรีพอร์ต</th>
              <th className="px-3 py-2 text-right">คะแนนเฉลี่ย</th>
              <th className="py-2 pl-3 text-right">ต่ออายุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => {
              const quota = ownerQuotas[row.owner] || 0;
              // #บรรลุเป้า is only meaningful against a SINGLE month's quota — with
              // "ทุกเดือน" scoped, row.revenue sums every month while the quota is a
              // monthly target, so the % would be inflated/meaningless (BUG 4). The
              // quota input itself stays editable regardless of scope.
              const attainmentPct =
                scopeIsSingleMonth && quota > 0 ? Math.round((row.revenue / quota) * 100) : null;
              return (
                <tr key={row.owner}>
                  <td className="py-2.5 pr-3 font-semibold text-ink">{row.owner}</td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {row.count.toLocaleString("th-TH")}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">{money(row.revenue)}</td>
                  <td className="px-3 py-2.5 text-right">
                    <input
                      type="text"
                      inputMode="numeric"
                      // plain digits (not toLocaleString) so a thousands comma isn't
                      // inserted mid-typing, which would jump the caret
                      value={quota > 0 ? String(quota) : ""}
                      onChange={(event) => {
                        const digits = event.target.value.replace(/[^0-9]/g, "");
                        setOwnerQuota(row.owner, digits ? Number(digits) : 0);
                      }}
                      placeholder="—"
                      aria-label={`เป้าหมายรายได้ต่อเดือนของ ${row.owner}`}
                      className="tnum w-24 rounded-md border border-border px-2 py-1 text-right text-sm text-ink outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                    />
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold">
                    {attainmentPct === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <span className={attainmentPct >= 100 ? "text-success-dark" : "text-warning-dark"}>
                        {attainmentPct}%
                      </span>
                    )}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                    {row.achievedPct}%
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-semibold text-ink">
                    {row.reportSentPct}%
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-ink">
                    {row.ratedCount > 0
                      ? `⭐ ${row.avgRating.toFixed(1)} · ${row.ratedCount.toLocaleString("th-TH")}`
                      : "—"}
                  </td>
                  <td className="tnum py-2.5 pl-3 text-right">
                    {row.renewalRate !== null ? (
                      <span className="font-semibold text-ink">
                        {row.renewalRate}%
                        <span className="ml-1 font-normal text-muted">
                          (ต่อ {row.renewedCount}/เสีย {row.lostCount})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RevenueChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "warning" | "muted";
}) {
  return (
    <Chip tone={tone}>
      {label}
      <span className="tnum font-bold">{value}</span>
    </Chip>
  );
}

function PriceIntegrityPanel({ issues }: { issues: PriceIntegrityIssues }) {
  const openItemModal = useStore((state) => state.openItemModal);
  if (issues.count === 0) return null;

  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-error-light text-error-dark">
          <AlertTriangle className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">ตรวจสอบข้อมูลราคา</h2>
          <p className="text-xs text-muted">
            รายการที่ราคาอาจผิดหรือหายไป — คลิกเพื่อเปิดแก้ไข
          </p>
        </div>
      </div>
      <div className="space-y-4">
        {issues.unpricedDelivered.length ? (
          <PriceIssueGroup
            title="งานส่งแล้วแต่ไม่มีราคา (รายได้ที่มองไม่เห็น)"
            rows={issues.unpricedDelivered}
            onOpenItem={openItemModal}
          />
        ) : null}
        {issues.negative.length ? (
          <PriceIssueGroup
            title="ราคาติดลบ (ข้อมูลผิด)"
            rows={issues.negative}
            onOpenItem={openItemModal}
            showPrice
          />
        ) : null}
      </div>
    </section>
  );
}

function PriceIssueGroup({
  title,
  rows,
  onOpenItem,
  showPrice,
}: {
  title: string;
  rows: PriceIssueRow[];
  onOpenItem: (id?: string | null) => void;
  showPrice?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted">
        {title} <span className="tnum text-muted">({rows.length.toLocaleString("th-TH")})</span>
      </p>
      <div className="mt-1.5 divide-y divide-border rounded-lg border border-border">
        {rows.map(({ item, customerName }) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onOpenItem(item.id)}
            className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-100"
            aria-label={`แก้ไขชิ้นงาน ${itemName(item)} ของ ${customerName}`}
          >
            <span className="min-w-0 truncate text-ink">
              <span className="font-semibold text-ink">{customerName}</span>
              <span className="text-muted"> · </span>
              {itemName(item)}
            </span>
            {showPrice ? (
              <span className="tnum shrink-0 font-semibold text-error-dark">{money(item.price)}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function UnbilledQuotationsPanel({ summary }: { summary: UnbilledSummary }) {
  const setFilter = useStore((state) => state.setFilter);
  const setView = useStore((state) => state.setView);
  if (summary.count === 0) return null;

  const goToQt = (row: UnbilledQuotation) => {
    setFilter("qtNo", row.qtNo);
    setView("items");
  };

  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-error-light text-error-dark">
            <Receipt className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">ใบเสนอราคาค้างวางบิล (QO&rarr;INV)</h2>
            <p className="text-xs text-muted">
              ใบเสนอราคาที่มีรายได้แต่ยังไม่ออก INV ครบ — คลิกแถวเพื่อดูรายการชิ้นงาน
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm">
          <span className="text-muted">รวมค้างวางบิล </span>
          <span className="tnum font-semibold text-error-dark">{money(summary.totalUnbilled)}</span>
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold text-muted">
              <th className="py-2 pr-3 text-left">QT</th>
              <th className="px-3 py-2 text-left">ลูกค้า</th>
              <th className="px-3 py-2 text-left">สถานะ</th>
              <th className="px-3 py-2 text-right">ค้างวางบิล</th>
              <th className="py-2 pl-3 text-right">อายุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {summary.rows.map((row) => (
              <tr
                key={`${row.customerId}||${row.qtNo}`}
                tabIndex={0}
                role="button"
                onClick={() => goToQt(row)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  goToQt(row);
                }}
                aria-label={`ดูรายการชิ้นงานของใบเสนอราคา ${row.qtNo} (${row.customerName})`}
                className="cursor-pointer transition-colors hover:bg-slate-100 focus:outline-none focus-visible:bg-slate-100 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-100"
              >
                <td className="py-2.5 pr-3 font-semibold text-brand-700">{row.qtNo}</td>
                <td className="px-3 py-2.5 text-ink">{row.customerName}</td>
                <td className="px-3 py-2.5">
                  <UnbilledStatusBadge status={row.status} />
                </td>
                <td className="tnum px-3 py-2.5 text-right font-semibold text-error-dark">
                  {money(row.unbilledRevenue)}
                </td>
                <td
                  className={`tnum py-2.5 pl-3 text-right ${
                    row.ageDays !== null && row.ageDays > 30 ? "font-semibold text-error-dark" : "text-ink"
                  }`}
                >
                  {row.ageDays === null ? "—" : `${row.ageDays.toLocaleString("th-TH")} วัน`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnbilledStatusBadge({ status }: { status: UnbilledQuotation["status"] }) {
  const config =
    status === "unbilled"
      ? { label: "ยังไม่วางบิล", tone: "error" as const }
      : { label: "วางบิลบางส่วน", tone: "warning" as const };
  return <Chip tone={config.tone}>{config.label}</Chip>;
}

function RenewalPanel({
  renewal,
  outcomes,
}: {
  renewal: ReturnType<typeof renewalPipeline>;
  outcomes: ReturnType<typeof renewalOutcomes>;
}) {
  const tiles: { label: string; hint: string; bucket: RenewalBucket; tone: "rose" | "amber" | "brand" }[] = [
    { label: "หมดอายุแล้ว", hint: "ต่ออายุด่วน", bucket: renewal.expired, tone: "rose" },
    { label: "ภายใน 30 วัน", hint: "ใกล้หมดอายุ", bucket: renewal.within30, tone: "amber" },
    { label: "ภายใน 60 วัน", hint: "สะสม", bucket: renewal.within60, tone: "amber" },
    { label: "ภายใน 90 วัน", hint: "สะสม", bucket: renewal.within90, tone: "brand" },
  ];
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-warning-light text-warning-dark">
          <RefreshCw className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">การต่ออายุ &amp; รายได้เสี่ยง</h2>
          <p className="text-xs text-muted">มูลค่างานที่ใกล้/หมดอายุ (อิงวันสิ้นสุด) — โอกาสต่ออายุ</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <RenewalTile key={tile.label} {...tile} />
        ))}
      </div>
      {outcomes.renewed + outcomes.lost > 0 ? (
        <p className="mt-3 text-xs text-muted">
          ผลการต่ออายุ:{" "}
          <span className="tnum font-semibold text-success-dark">ต่อแล้ว {outcomes.renewed}</span> ·{" "}
          <span className="tnum font-semibold text-error-dark">เสีย {outcomes.lost}</span>
          {outcomes.rate !== null ? (
            <>
              {" "}
              · อัตราต่ออายุ{" "}
              <span className="tnum font-semibold text-ink">{outcomes.rate}%</span>
            </>
          ) : null}
          {outcomes.pending > 0 ? <> · รอต่ออายุ {outcomes.pending.toLocaleString("th-TH")}</> : null}
        </p>
      ) : (
        <p className="mt-3 text-xs text-muted">
          ยังไม่มีการบันทึกผลต่ออายุ — กด &quot;ต่ออายุแล้ว&quot; ที่รายการหมดอายุใน &quot;สิ่งที่ต้องทำ&quot;
        </p>
      )}
    </section>
  );
}

function RenewalTile({
  label,
  hint,
  bucket,
  tone,
}: {
  label: string;
  hint: string;
  bucket: RenewalBucket;
  tone: "rose" | "amber" | "brand";
}) {
  const toneClass =
    tone === "rose"
      ? "border-error-light bg-error-light"
      : tone === "amber"
        ? "border-warning-light bg-warning-light"
        : "border-brand-100 bg-brand-50";
  const valueClass =
    tone === "rose" ? "text-error-dark" : tone === "amber" ? "text-warning-dark" : "text-brand-700";
  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">{label}</p>
        {tone === "rose" ? (
          <AlertTriangle className="size-3.5 shrink-0 text-error" aria-hidden="true" />
        ) : null}
      </div>
      <p className={`tnum mt-1.5 text-xl font-bold ${valueClass}`}>{money(bucket.revenue)}</p>
      <p className="tnum mt-0.5 text-xs text-muted">
        {bucket.count.toLocaleString("th-TH")} งาน · {hint}
      </p>
    </div>
  );
}

const FORECAST_TONE_CLASSES: Record<"slate" | "amber" | "brand" | "emerald", { border: string; value: string }> = {
  slate: { border: "border-border-soft bg-slate-100", value: "text-ink" },
  amber: { border: "border-warning-light bg-warning-light", value: "text-warning-dark" },
  brand: { border: "border-brand-100 bg-brand-50", value: "text-brand-700" },
  emerald: { border: "border-success-light bg-success-light", value: "text-success-dark" },
};

function ForecastPanel({ forecast }: { forecast: RevenueForecast }) {
  return (
    <section className={`report-panel ${cardClass} p-4`}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary-light text-info-dark">
          <TrendingUp className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-ink">คาดการณ์รายได้ล่วงหน้า</h2>
          <p className="text-xs text-muted">
            รายได้รอวางบิลบวกรายได้ต่ออายุที่คาดว่าจะได้ — อิงงานที่มีอยู่จริง ไม่ใช่ตัวเลขเดา
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <ForecastTile
          label="รอวางบิล (committed)"
          value={money(forecast.committed)}
          hint="เสนอราคาแล้ว ยังไม่ออก INV"
          tone="slate"
        />
        <ForecastTile
          label="มูลค่ารอต่ออายุ"
          value={money(forecast.atRiskRevenue)}
          hint="หมดอายุแล้ว + ใกล้หมดอายุใน 90 วัน"
          tone="amber"
        />
        <ForecastTile
          label="คาดว่าจะต่ออายุ"
          value={forecast.expectedRenewal === null ? "—" : money(forecast.expectedRenewal)}
          hint={forecast.renewalRate === null ? "ยังไม่มีอัตราต่ออายุ" : `อิงอัตราต่ออายุ ${forecast.renewalRate}%`}
          tone="brand"
        />
        <ForecastTile
          label="คาดการณ์รวม"
          value={forecast.forecastTotal === null ? "—" : money(forecast.forecastTotal)}
          hint="รอวางบิล + คาดว่าจะต่ออายุ"
          tone="emerald"
        />
      </div>
      {forecast.renewalRate === null ? (
        <p className="mt-3 text-xs text-muted">
          ยังไม่มีอัตราต่ออายุพอจะประเมิน — แสดงเฉพาะยอดรอวางบิล
        </p>
      ) : null}
    </section>
  );
}

function ForecastTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: keyof typeof FORECAST_TONE_CLASSES;
}) {
  const toneClass = FORECAST_TONE_CLASSES[tone];
  return (
    <div className={`rounded-lg border p-3 ${toneClass.border}`}>
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`tnum mt-1.5 text-xl font-bold ${toneClass.value}`}>{value}</p>
      <p className="tnum mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

// Modernize DashboardCard-style header (title + subtitle) for every chart
// wrapper — report-panel/report-chart-card/report-chart-hero stay on the
// outer element (DashboardCard forwards `className` onto it) and
// report-chart-body stays on the canvas-height wrapper the print stylesheet
// resizes, via `bodyClassName`.
function ChartCard({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardCard
      title={title}
      subtitle={description}
      className={`report-panel report-chart-card${className ? ` ${className}` : ""}`}
      bodyClassName="report-chart-body h-72"
    >
      {children}
    </DashboardCard>
  );
}

function EmptyScopedState() {
  return (
    <section className={emptyCardClass}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-brand-600 shadow-card">
        <BarChart3 className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-ink">ไม่มีข้อมูลในเดือนนี้</h2>
      <p className="mt-1 text-sm text-muted">เลือกทุกเดือนหรือปรับตัวกรองเพื่อดูรายงาน</p>
    </section>
  );
}

function publishMonthKey(value: string) {
  const key = value.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(key) ? key : "";
}

function formatThaiBuddhistMonth(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex >= THAI_MONTHS_FULL.length) return month;
  return `${THAI_MONTHS_FULL[monthIndex]} ${year + 543}`;
}
