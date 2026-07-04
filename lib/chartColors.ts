import { CHANNEL } from "./constants";
import type { ChannelKey } from "./types";

/**
 * Validated categorical entity palette for chart DATA FILLS only (bars/marks) —
 * not for `CHANNEL.color`, which stays the raw brand hex used elsewhere (e.g. the
 * small legend dot in ChannelPerformancePanel). A brand hex is not safe as a data
 * fill: YouTube's pure red (#FF0000) and TikTok's near-black (#111827) read as
 * status-red / axis-ink rather than series identity, and neither was validated
 * for CVD separation as a set.
 *
 * These 8 hues + fixed order are the dataviz skill's reference instance
 * (references/palette.md) — re-validated here for this app's white chart surface:
 *   node scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100,#008300,#4a3aa7,#e34948,#e87ba4,#eb6834" \
 *     --mode light --surface "#ffffff"
 *   → Lightness band PASS · Chroma floor PASS · CVD separation PASS (worst
 *     adjacent ΔE 24.2) · Contrast WARN on 3 slots (aqua/yellow/magenta) — legal
 *     because every chart that uses this palette also direct-labels its bars
 *     (ApexCharts dataLabels) and has a same-data table alongside it (the relief
 *     channel the WARN requires).
 *
 * The order is fixed and never cycled — each CHANNEL key always maps to the same
 * slot, so a filter that changes which channels are present never repaints the
 * survivors.
 */
const CATEGORICAL_PALETTE = [
  "#2a78d6", // slot 1 — blue
  "#1baf7a", // slot 2 — aqua
  "#eda100", // slot 3 — yellow
  "#008300", // slot 4 — green
  "#4a3aa7", // slot 5 — violet
  "#e34948", // slot 6 — red (not pure #FF0000)
  "#e87ba4", // slot 7 — magenta
  "#eb6834", // slot 8 — orange (unused today — only 7 CHANNEL entries exist)
] as const;

export const CHANNEL_CHART_COLOR: Record<ChannelKey, string> = Object.fromEntries(
  CHANNEL.map((channel, index) => [channel.key, CATEGORICAL_PALETTE[index % CATEGORICAL_PALETTE.length]]),
) as Record<ChannelKey, string>;
