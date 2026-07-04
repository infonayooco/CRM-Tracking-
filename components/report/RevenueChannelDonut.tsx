"use client";

import { useMemo } from "react";
import { ApexChart } from "@/components/charts/apex/ApexChart";
import { donutChartOptions } from "@/components/charts/apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import { CHANNEL_CHART_COLOR } from "@/lib/chartColors";
import type { Customer, Item } from "@/lib/types";

// Donut companion to RevenueByChannel's bar chart — same byChannel series and
// the same categorical CHANNEL_CHART_COLOR palette (never the raw CHANNEL.color
// brand hex, which is unsafe as a data fill — see lib/chartColors.ts), just a
// share-of-total view sitting beside the revenue trend hero chart instead of
// an absolute-value bar.
export function RevenueChannelDonut({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const rows = useMemo(() => dashboardStats(items, customers).byChannel, [items, customers]);

  const labels = useMemo(() => rows.map((entry) => entry.channel.label), [rows]);
  const values = useMemo(() => rows.map((entry) => entry.value), [rows]);
  const colors = useMemo(() => rows.map((entry) => CHANNEL_CHART_COLOR[entry.channel.key]), [rows]);

  const options = useMemo(
    () => donutChartOptions({ labels, colors, currency: true, totalLabel: "รายได้รวม" }),
    [labels, colors],
  );

  if (!rows.length) return <EmptyChart label="ยังไม่มีรายได้" />;

  return (
    <ApexChart type="donut" height="100%" className="h-full" series={values} options={options} />
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="grid h-full place-items-center text-sm text-muted">{label}</div>;
}
