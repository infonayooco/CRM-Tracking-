"use client";

import { useMemo } from "react";
import { ApexChart } from "@/components/charts/apex/ApexChart";
import { APEX, radialBarOptions, sparklineOptions } from "@/components/charts/apex/apexTheme";

type GaugeTone = "primary" | "secondary" | "success" | "warning" | "error" | "info";

const GAUGE_COLOR: Record<GaugeTone, string> = {
  primary: APEX.primary,
  secondary: APEX.secondary,
  success: APEX.success,
  warning: APEX.warning,
  error: APEX.error,
  info: APEX.info,
};

// Compact revenue trend footer for the "รายได้รวม" hero KPI tile — same
// sparkline shape as HomeView's RevenueStatTile (dashboardStats().byMonth fed
// straight in, area sparkline, no data labels). Needs at least 2 points for a
// trend line to mean anything; with 0-1 months of real publishDate-bucketed
// revenue, render nothing rather than fabricate a flat/empty line.
export function KpiRevenueSparkline({ monthly }: { monthly: { month: string; value: number }[] }) {
  const values = useMemo(() => monthly.map((entry) => entry.value), [monthly]);
  const options = useMemo(
    () => ({
      ...sparklineOptions({ type: "area", color: APEX.primary, currency: true }),
      dataLabels: { enabled: false },
    }),
    [],
  );

  if (values.length < 2) return null;

  return (
    <div className="mt-3 h-10">
      <ApexChart
        type="area"
        height="100%"
        className="h-full"
        series={[{ name: "รายได้", data: values }]}
        options={options}
      />
    </div>
  );
}

// Compact radial gauge footer for %-based hero KPI tiles (attainment / report
// sent rate) — single-value ring, tone-matched to the tile's own icon color so
// the gauge reads as the same metric rather than a new color language.
export function KpiRadialGauge({ value, label, tone }: { value: number; label: string; tone: GaugeTone }) {
  const options = useMemo(() => radialBarOptions({ label, color: GAUGE_COLOR[tone] }), [label, tone]);

  return (
    <div className="mt-3 h-28">
      <ApexChart type="radialBar" height="100%" className="h-full" series={[value]} options={options} />
    </div>
  );
}
