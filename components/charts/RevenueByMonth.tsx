"use client";

import { useMemo } from "react";
import { ApexChart } from "./apex/ApexChart";
import { APEX, areaChartOptions } from "./apex/apexTheme";
import { dashboardStats } from "@/lib/derived";
import { THAI_MONTHS } from "@/lib/constants";
import type { Customer, Item } from "@/lib/types";

// "2026-06" → "มิ.ย. 69" (Thai short month + 2-digit Buddhist year) — this chart
// is the hero trend, so its axis reads like the rest of the report's Thai dates
// instead of a raw ISO month key.
function formatThaiMonthShort(month: string) {
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex >= THAI_MONTHS.length) return month;
  const buddhistYear = year + 543;
  const shortYear = String(buddhistYear).slice(-2);
  return `${THAI_MONTHS[monthIndex]} ${shortYear}`;
}

export function RevenueByMonth({ items, customers }: { items: Item[]; customers: Customer[] }) {
  const rows = useMemo(() => dashboardStats(items, customers).byMonth, [items, customers]);

  const categories = useMemo(() => rows.map((entry) => formatThaiMonthShort(entry.month)), [rows]);
  const values = useMemo(() => rows.map((entry) => entry.value), [rows]);

  const options = useMemo(
    () => areaChartOptions({ categories, colors: [APEX.primary], currency: true }),
    [categories],
  );

  if (!rows.length) return <EmptyChart label="ยังไม่มี Publish Date" />;

  return (
    <ApexChart
      type="area"
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
