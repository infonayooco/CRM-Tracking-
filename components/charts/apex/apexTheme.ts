import type { ApexOptions } from "apexcharts";

// Modernize's Latin typeface first, Thai fallback — mirrors app/globals.css --font-sans.
export const APEX_FONT =
  '"Plus Jakarta Sans", "IBM Plex Sans Thai", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

// Modernize semantic palette as raw hex (ApexCharts needs colors, not Tailwind tokens).
export const APEX = {
  primary: "#5d87ff",
  primaryLight: "#ecf2ff",
  primaryDark: "#4570ea",
  secondary: "#49beff",
  secondaryLight: "#e8f7ff",
  success: "#13deb9",
  successLight: "#e6fffa",
  warning: "#ffae1f",
  warningLight: "#fef5e5",
  error: "#fa896b",
  errorLight: "#fdede8",
  info: "#539bff",
  infoLight: "#ebf3fe",
  ink: "#2a3547",
  muted: "#7c8fac",
  border: "#eaeff4",
  surface: "#ffffff",
} as const;

/** Default categorical series order (Modernize cycles primary→secondary→…). */
export const APEX_SERIES_COLORS = [
  APEX.primary,
  APEX.secondary,
  APEX.success,
  APEX.warning,
  APEX.error,
  APEX.info,
];

/** Periwinkle sequential ramp for ordinal data (funnels, ranked bars). */
export const APEX_BRAND_RAMP = ["#94abff", "#7a97ff", "#6e93ff", "#5d87ff", "#4570ea"];

export const thaiNumber = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString("th-TH");
export const thaiBaht = (n: number) => "฿" + thaiNumber(Math.round(Number.isFinite(n) ? n : 0));

const axisLabelStyle = { colors: APEX.muted, fontFamily: APEX_FONT, fontSize: "12px" } as const;

/** Shared base every preset extends: no toolbar, muted labels, dashed grid, dark tooltip. */
export function baseChartOptions(): ApexOptions {
  return {
    chart: {
      fontFamily: APEX_FONT,
      foreColor: APEX.muted,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 450 },
      parentHeightOffset: 0,
    },
    colors: APEX_SERIES_COLORS,
    grid: {
      borderColor: APEX.border,
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { left: 12, right: 12, top: 0 },
    },
    dataLabels: { enabled: false },
    tooltip: { theme: "dark", style: { fontSize: "12px", fontFamily: APEX_FONT } },
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontFamily: APEX_FONT,
      fontSize: "12px",
      labels: { colors: APEX.muted },
      markers: { size: 6 },
      itemMargin: { horizontal: 8, vertical: 4 },
    },
  };
}

type AreaOpts = {
  categories: (string | number)[];
  colors?: string[];
  currency?: boolean;
  labelLastPointOnly?: boolean;
};

/** Smooth area chart with a soft gradient fill — the Modernize "revenue trend" look. */
export function areaChartOptions({ categories, colors, currency }: AreaOpts): ApexOptions {
  const base = baseChartOptions();
  const fmt = currency ? thaiBaht : thaiNumber;
  return {
    ...base,
    chart: { ...base.chart, type: "area" },
    colors: colors ?? [APEX.primary],
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 90, 100] },
    },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: axisLabelStyle },
      tooltip: { enabled: false },
    },
    yaxis: { labels: { style: axisLabelStyle, formatter: (v: number) => fmt(v) } },
    tooltip: { ...base.tooltip, y: { formatter: (v: number) => fmt(v) } },
  };
}

type BarOpts = {
  categories: (string | number)[];
  horizontal?: boolean;
  colors?: string[];
  distributed?: boolean;
  currency?: boolean;
  height?: number;
};

/** Rounded-cap bar/column chart. `distributed` colors each bar from `colors`. */
export function barChartOptions({
  categories,
  horizontal = false,
  colors,
  distributed = false,
  currency = false,
}: BarOpts): ApexOptions {
  const base = baseChartOptions();
  const fmt = currency ? thaiBaht : thaiNumber;
  return {
    ...base,
    chart: { ...base.chart, type: "bar" },
    colors: colors ?? [APEX.primary],
    plotOptions: {
      bar: {
        horizontal,
        distributed,
        borderRadius: 6,
        borderRadiusApplication: "end",
        columnWidth: "55%",
        barHeight: "62%",
      },
    },
    stroke: { show: false },
    legend: { ...base.legend, show: false },
    xaxis: {
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: axisLabelStyle,
        formatter: horizontal ? (v: string) => fmt(Number(v)) : undefined,
      },
    },
    yaxis: {
      labels: {
        style: axisLabelStyle,
        formatter: horizontal ? undefined : (v: number) => fmt(v),
      },
    },
    tooltip: { ...base.tooltip, y: { formatter: (v: number) => fmt(v) } },
  };
}

type DonutOpts = {
  labels: string[];
  colors?: string[];
  currency?: boolean;
  totalLabel?: string;
};

/** Donut with rounded arcs + a total in the center — Modernize's signature donut. */
export function donutChartOptions({
  labels,
  colors,
  currency = false,
  totalLabel = "รวม",
}: DonutOpts): ApexOptions {
  const base = baseChartOptions();
  const fmt = currency ? thaiBaht : thaiNumber;
  return {
    ...base,
    chart: { ...base.chart, type: "donut" },
    labels,
    colors: colors ?? APEX_SERIES_COLORS,
    stroke: { width: 2, colors: [APEX.surface] },
    plotOptions: {
      pie: {
        donut: {
          size: "72%",
          labels: {
            show: true,
            name: { fontFamily: APEX_FONT, color: APEX.muted, fontSize: "13px" },
            value: {
              fontFamily: APEX_FONT,
              color: APEX.ink,
              fontSize: "22px",
              fontWeight: 700,
              formatter: (v: string) => fmt(Number(v)),
            },
            total: {
              show: true,
              label: totalLabel,
              color: APEX.muted,
              fontFamily: APEX_FONT,
              formatter: (w) =>
                fmt(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
            },
          },
        },
      },
    },
    dataLabels: { enabled: false },
    tooltip: { ...base.tooltip, y: { formatter: (v: number) => fmt(v) } },
  };
}

type RadialOpts = { label: string; color?: string };

/** Single-value radial gauge (Modernize uses these for % KPIs like attainment). */
export function radialBarOptions({ label, color = APEX.primary }: RadialOpts): ApexOptions {
  const base = baseChartOptions();
  return {
    ...base,
    chart: { ...base.chart, type: "radialBar" },
    colors: [color],
    labels: [label],
    plotOptions: {
      radialBar: {
        hollow: { size: "62%" },
        track: { background: APEX.border, strokeWidth: "100%" },
        dataLabels: {
          name: { fontFamily: APEX_FONT, color: APEX.muted, fontSize: "13px", offsetY: 22 },
          value: {
            fontFamily: APEX_FONT,
            color: APEX.ink,
            fontSize: "26px",
            fontWeight: 700,
            offsetY: -18,
            formatter: (v: number) => `${Math.round(v)}%`,
          },
        },
      },
    },
    fill: {
      // No gradientToColors → ApexCharts auto-lightens `color` itself, so the
      // gauge stays the tone's own hue (e.g. success green) instead of fading to
      // a hardcoded cyan.
      type: "gradient",
      gradient: { shade: "light", shadeIntensity: 0.4, type: "horizontal", stops: [0, 100] },
    },
    stroke: { lineCap: "round" },
    legend: { ...base.legend, show: false },
  };
}

/** Tiny sparkline (no axes/grid) for the footer of a metric card. */
export function sparklineOptions({
  type = "area",
  color = APEX.primary,
  currency = false,
}: {
  type?: "area" | "line" | "bar";
  color?: string;
  currency?: boolean;
} = {}): ApexOptions {
  const fmt = currency ? thaiBaht : thaiNumber;
  const options: ApexOptions = {
    chart: { type, fontFamily: APEX_FONT, sparkline: { enabled: true }, animations: { enabled: true } },
    colors: [color],
    stroke: { curve: "smooth", width: 2 },
    fill:
      type === "area"
        ? { type: "gradient", gradient: { opacityFrom: 0.4, opacityTo: 0.05 } }
        : { opacity: 1 },
    tooltip: {
      theme: "dark",
      style: { fontFamily: APEX_FONT, fontSize: "12px" },
      y: { formatter: (v: number) => fmt(v) },
      marker: { show: false },
    },
  };
  // IMPORTANT: only add plotOptions for bar. Setting `plotOptions: undefined`
  // would clobber ApexCharts' own default plotOptions (which includes
  // plotOptions.line) during its merge, then Globals reads
  // config.plotOptions.line.isSlopeChart and throws "reading 'line'".
  if (type === "bar") {
    options.plotOptions = { bar: { borderRadius: 3, columnWidth: "55%" } };
  }
  return options;
}
