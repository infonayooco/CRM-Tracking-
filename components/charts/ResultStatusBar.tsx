"use client";

import { useMemo } from "react";
import { ApexChart } from "./apex/ApexChart";
import { APEX, APEX_FONT, barChartOptions, thaiNumber } from "./apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import type { Customer, Item } from "@/lib/types";

// Horizontal ordinal bar (ApexCharts) — statuses stay in their fixed pipeline
// order (never sorted by count) and take the app's own status.dot colors, so the
// chart matches every badge/dot for the same status elsewhere.
export function ResultStatusBar({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const counts = useMemo(() => dashboardStats(items, customers).resultCounts, [items, customers]);
  const hasData = counts.some((entry) => entry.value > 0);

  const categories = useMemo(() => counts.map((entry) => entry.status.label), [counts]);
  const values = useMemo(() => counts.map((entry) => entry.value), [counts]);
  const colors = useMemo(() => counts.map((entry) => entry.status.dot), [counts]);

  const options = useMemo(() => {
    const base = barChartOptions({ categories, horizontal: true, colors, distributed: true });
    return {
      ...base,
      dataLabels: {
        enabled: true,
        style: { fontFamily: APEX_FONT, fontSize: "12px", fontWeight: 600, colors: [APEX.ink] },
        formatter: (val: number) => thaiNumber(val),
      },
      tooltip: { ...base.tooltip, y: { formatter: (v: number) => `${thaiNumber(v)} ชิ้นงาน` } },
    };
  }, [categories, colors]);

  if (!hasData) return <EmptyChart label="ยังไม่มีข้อมูล" />;

  return (
    <ApexChart
      type="bar"
      height="100%"
      className="h-full"
      series={[{ name: "จำนวนชิ้นงาน", data: values }]}
      options={options}
    />
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-sm text-muted">{label}</div>;
}
