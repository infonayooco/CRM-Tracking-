"use client";

import { useMemo, useState } from "react";
import type { ApexOptions } from "apexcharts";
import { ApexChart, type ApexChartProps } from "./ApexChart";
import { APEX, APEX_FONT, baseChartOptions } from "./apexTheme";
import type { GanttRow } from "@/lib/derived";

// react-apexcharts / the underlying ApexCharts lib both support "rangeBar" (see
// node_modules/apexcharts/types/apexcharts.d.ts), but the shared <ApexChart>
// wrapper's ApexChartType union intentionally covers only the chart kinds the
// rest of the app already uses. Rather than widen that shared union for this
// one new chart, the cast is scoped to this file only.
const RANGE_BAR_TYPE = "rangeBar" as ApexChartProps["type"];

const thaiShortDate = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatThaiDate(ms: number) {
  return thaiShortDate.format(new Date(ms));
}

function formatThaiRange(start: number, end: number) {
  return `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ROW_HEIGHT = 34; // px per bar row — keeps long lists readable
const MIN_HEIGHT = 220;
const HEADER_ALLOWANCE = 60; // room for the x-axis labels below the bars

export function GanttChart({ rows }: { rows: GanttRow[] }) {
  // Captured once at mount via a lazy state initializer so render stays pure
  // (react-hooks/purity) — the "today" reference line needn't tick mid-session.
  const [todayMs] = useState(() => Date.now());

  const series = useMemo(
    () => [
      {
        name: "ระยะเวลา",
        data: rows.map((row) => ({
          x: row.label,
          y: [row.start, row.end],
          fillColor: row.color,
        })),
      },
    ],
    [rows],
  );

  const options = useMemo((): ApexOptions => {
    const base = baseChartOptions();
    return {
      ...base,
      chart: { ...base.chart, type: "rangeBar" },
      plotOptions: {
        bar: {
          horizontal: true,
          borderRadius: 6,
          borderRadiusApplication: "end",
          barHeight: "55%",
        },
      },
      dataLabels: { enabled: false },
      xaxis: {
        type: "datetime",
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: APEX.muted, fontFamily: APEX_FONT, fontSize: "12px" },
          formatter: (_value, timestamp) =>
            typeof timestamp === "number" ? formatThaiDate(timestamp) : "",
        },
      },
      yaxis: {
        labels: {
          style: { colors: APEX.ink, fontFamily: APEX_FONT, fontSize: "12px" },
        },
      },
      grid: {
        ...base.grid,
        yaxis: { lines: { show: false } },
      },
      // A "today" reference line so bars can be read against now at a glance
      // (Apex clips it automatically if today falls outside the data range).
      annotations: {
        xaxis: [
          {
            x: todayMs,
            strokeDashArray: 4,
            borderColor: APEX.muted,
            label: {
              text: "วันนี้",
              borderColor: APEX.muted,
              style: {
                color: "#ffffff",
                background: APEX.muted,
                fontFamily: APEX_FONT,
                fontSize: "11px",
              },
            },
          },
        ],
      },
      legend: { show: false },
      tooltip: {
        theme: "dark",
        style: { fontFamily: APEX_FONT, fontSize: "12px" },
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const row = rows[dataPointIndex];
          if (!row) return "";
          return `
            <div class="px-3 py-2">
              <div class="font-semibold">${escapeHtml(row.label)}</div>
              <div class="mt-1 text-xs opacity-80">${escapeHtml(formatThaiRange(row.start, row.end))}</div>
            </div>
          `;
        },
      },
    };
  }, [rows, todayMs]);

  if (!rows.length) {
    return (
      <div className="grid h-48 place-items-center text-sm text-muted">
        ยังไม่มีชิ้นงานที่มีวันที่ระบุ
      </div>
    );
  }

  const height = Math.max(MIN_HEIGHT, rows.length * ROW_HEIGHT + HEADER_ALLOWANCE);

  return (
    <ApexChart
      type={RANGE_BAR_TYPE}
      height={height}
      series={series}
      options={options}
    />
  );
}
