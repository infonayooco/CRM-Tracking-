"use client";

import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";

// ApexCharts touches `window`/`document` at import time, which crashes during
// Next's server render / static prerender. Loading react-apexcharts through a
// client-only dynamic import (ssr:false) is the ONLY safe way to use it here —
// every chart in the app renders through this single wrapper.
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

export type ApexChartType =
  | "line"
  | "area"
  | "bar"
  | "rangeBar"
  | "donut"
  | "pie"
  | "radialBar"
  | "radar"
  | "scatter"
  | "heatmap"
  | "polarArea";

export type ApexChartProps = {
  type: ApexChartType;
  /** Axis charts: ApexAxisChartSeries. Donut/pie/radialBar: number[] (ApexNonAxisChartSeries). */
  series: ApexAxisChartSeries | ApexNonAxisChartSeries;
  options?: ApexOptions;
  height?: number | string;
  width?: number | string;
  /** Wrapper class — size/spacing lives here; the chart fills it. */
  className?: string;
};

export function ApexChart({
  type,
  series,
  options,
  height = 300,
  width = "100%",
  className,
}: ApexChartProps) {
  return (
    <div className={className}>
      <ReactApexChart type={type} series={series} options={options} height={height} width={width} />
    </div>
  );
}
