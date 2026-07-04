"use client";

import { useMemo } from "react";
import { ApexChart } from "./apex/ApexChart";
import { APEX, APEX_FONT, barChartOptions, thaiBaht } from "./apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import { CHANNEL_CHART_COLOR } from "@/lib/chartColors";
import type { Customer, Item } from "@/lib/types";

export function RevenueByChannel({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const rows = useMemo(() => dashboardStats(items, customers).byChannel, [items, customers]);

  const categories = useMemo(() => rows.map((entry) => entry.channel.label), [rows]);
  const values = useMemo(() => rows.map((entry) => entry.value), [rows]);
  // Validated categorical palette, mapped by channel key (see lib/chartColors.ts)
  // — NOT the raw CHANNEL.color brand hex, which includes pure red (YouTube)
  // and near-black (TikTok) unsafe as a data fill. The brand hex still appears
  // as the small legend dot in ChannelPerformancePanel's table.
  const colors = useMemo(() => rows.map((entry) => CHANNEL_CHART_COLOR[entry.channel.key]), [rows]);

  const options = useMemo(() => {
    const base = barChartOptions({ categories, colors, distributed: true, currency: true });
    return {
      ...base,
      // Every bar already carries its value via dataLabels — a money-formatted
      // tick axis would just repeat it (mirrors the pre-migration behavior).
      yaxis: { ...base.yaxis, labels: { show: false } },
      dataLabels: {
        enabled: true,
        style: { fontFamily: APEX_FONT, fontSize: "11px", fontWeight: 600, colors: [APEX.ink] },
        formatter: (val: number) => thaiBaht(val),
      },
      tooltip: { ...base.tooltip, y: { formatter: (v: number) => `รายได้ ${thaiBaht(v)}` } },
    };
  }, [categories, colors]);

  if (!rows.length) return <EmptyChart label="ยังไม่มีรายได้" />;

  return (
    <ApexChart
      type="bar"
      height="100%"
      className="h-full"
      series={[{ name: "รายได้", data: values }]}
      options={options}
    />
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-sm text-muted">{label}</div>;
}
