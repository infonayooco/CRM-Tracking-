"use client";

import { useMemo } from "react";
import { ApexChart } from "./apex/ApexChart";
import { APEX, APEX_FONT, barChartOptions, thaiBaht } from "./apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import type { Customer, Item } from "@/lib/types";

export function TopCustomers({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const rows = useMemo(() => dashboardStats(items, customers).topCustomers, [items, customers]);

  const categories = useMemo(() => rows.map((entry) => entry.customer.name), [rows]);
  const values = useMemo(() => rows.map((entry) => entry.value), [rows]);

  const options = useMemo(() => {
    const base = barChartOptions({
      categories,
      horizontal: true,
      currency: true,
      colors: [APEX.primary],
    });
    return {
      ...base,
      // Every bar already carries its value via the dataLabel below — a
      // money-formatted tick axis would just repeat it.
      xaxis: { ...base.xaxis, labels: { show: false } },
      dataLabels: {
        enabled: true,
        style: { fontFamily: APEX_FONT, fontSize: "12px", fontWeight: 600, colors: [APEX.ink] },
        formatter: (val: number) => thaiBaht(val),
      },
      tooltip: { ...base.tooltip, y: { formatter: (v: number) => `รายได้ ${thaiBaht(v)}` } },
    };
  }, [categories]);

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
