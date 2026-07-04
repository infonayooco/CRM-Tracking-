"use client";

import { useMemo } from "react";
import { ApexChart } from "./apex/ApexChart";
import { barChartOptions } from "./apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import type { Customer, Item } from "@/lib/types";

// Vertical rounded bar (ApexCharts) — one brand hue, currency-formatted
// axis/tooltip since every value here is revenue.
export function RevenueByOwner({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const rows = useMemo(() => dashboardStats(items, customers).byOwner, [items, customers]);

  const owners = useMemo(() => rows.map((entry) => entry.owner), [rows]);
  const values = useMemo(() => rows.map((entry) => entry.value), [rows]);

  const options = useMemo(() => barChartOptions({ categories: owners, currency: true }), [owners]);

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
