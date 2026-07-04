import { escapeCsv } from "./exportData";
import {
  channelPerformance,
  customerHealth,
  itemTypePerformance,
  ownerPerformance,
  renewalOutcomes,
  revenueBreakdown,
  unbilledQuotations,
} from "./derived";
import type { Customer, Item } from "./types";

// Thai labels mirroring the on-screen badges (CustomerHealthTierBadge /
// UnbilledStatusBadge in ReportView) so the CSV reads the same as the report.
const TIER_LABEL: Record<string, string> = {
  "at-risk": "เสี่ยงสูง",
  watch: "จับตา",
};

const UNBILLED_STATUS_LABEL: Record<string, string> = {
  unbilled: "ยังไม่วางบิล",
  partial: "วางบิลบางส่วน",
};

type CsvCell = string | number | null | undefined;

function csvLine(cells: CsvCell[]): string {
  return cells.map(escapeCsv).join(",");
}

// A section is only appended when `rows` is non-empty — callers pass the
// already-filtered/derived row list, so an empty array means "nothing to
// report" and the whole labeled block (title/header/blank line) is skipped
// rather than printing a header with no data underneath it.
function section(title: string, header: CsvCell[], rows: CsvCell[][]): string[] {
  if (!rows.length) return [];
  return [csvLine([title]), "", csvLine(header), ...rows.map(csvLine)];
}

// Serializes the COMPUTED analytics tables (not raw items) into one CSV so
// finance can pull the same numbers shown in ReportView without re-keying
// them. Numbers are kept raw (not money()-formatted with ฿) so spreadsheets
// treat them as numeric; a null/undefined numeric metric (e.g. an unrated
// group's avgRating) serializes as an empty cell via escapeCsv, never
// "null"/"NaN".
export function serializeAnalyticsCsv(items: Item[], customers: Customer[], today: Date): string {
  const blocks: string[][] = [];

  const breakdown = revenueBreakdown(items);
  blocks.push(
    section(
      "สรุปรายได้",
      ["รายการ", "จำนวนเงิน"],
      [
        ["รวมทั้งหมด", breakdown.total],
        ["วางบิลแล้ว", breakdown.invoiced],
        ["รอวางบิล", breakdown.quoted],
        ["หลังหัก VAT 7%", breakdown.netOfVat],
        ["VAT 7%", breakdown.vat],
      ],
    ),
  );

  blocks.push(
    section(
      "ผลงานตามเจ้าของงานขาย",
      ["เจ้าของงานขาย", "จำนวนชิ้นงาน", "รายได้", "%บรรลุผล", "%ส่งรีพอร์ต", "คะแนนเฉลี่ย", "%ต่ออายุ"],
      ownerPerformance(items, customers).map((row) => [
        row.owner,
        row.count,
        row.revenue,
        row.achievedPct,
        row.reportSentPct,
        row.ratedCount > 0 ? row.avgRating : null,
        row.renewalRate,
      ]),
    ),
  );

  blocks.push(
    section(
      "ผลงานตามช่องทาง",
      ["ช่องทาง", "จำนวนชิ้นงาน", "%บรรลุผล", "%ส่งรีพอร์ต", "คะแนนเฉลี่ย"],
      channelPerformance(items).map((row) => [
        row.label,
        row.count,
        row.achievedPct,
        row.reportSentPct,
        row.ratedCount > 0 ? row.avgRating : null,
      ]),
    ),
  );

  blocks.push(
    section(
      "ผลงานตามประเภทงาน",
      ["ประเภทงาน", "จำนวนชิ้นงาน", "%บรรลุผล", "%ส่งรีพอร์ต", "คะแนนเฉลี่ย"],
      itemTypePerformance(items).map((row) => [
        row.itemType,
        row.count,
        row.achievedPct,
        row.reportSentPct,
        row.ratedCount > 0 ? row.avgRating : null,
      ]),
    ),
  );

  blocks.push(
    section(
      "สุขภาพลูกค้า (เสี่ยง)",
      ["ชื่อลูกค้า", "ระดับความเสี่ยง", "เหตุผล", "รายได้", "รายได้เสี่ยง", "%บรรลุผล"],
      customerHealth(items, customers, today)
        .filter((row) => row.tier !== "healthy")
        .map((row) => [
          row.name,
          TIER_LABEL[row.tier] ?? row.tier,
          row.reason,
          row.revenue,
          row.revenueAtRisk,
          row.achievedPct,
        ]),
    ),
  );

  blocks.push(
    section(
      "ใบเสนอราคาค้างวางบิล",
      ["เลขที่ QT", "ชื่อลูกค้า", "สถานะ", "รายได้ค้างวางบิล", "อายุ (วัน)"],
      unbilledQuotations(items, customers, today).rows.map((row) => [
        row.qtNo,
        row.customerName,
        UNBILLED_STATUS_LABEL[row.status] ?? row.status,
        row.unbilledRevenue,
        row.ageDays,
      ]),
    ),
  );

  const outcomes = renewalOutcomes(items, today);
  blocks.push(
    section(
      "ผลการต่ออายุ",
      ["รวมหมดอายุ", "ต่ออายุแล้ว", "เสียลูกค้า", "รอดำเนินการ", "อัตราต่ออายุ (%)"],
      [[outcomes.total, outcomes.renewed, outcomes.lost, outcomes.pending, outcomes.rate]],
    ),
  );

  return blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\r\n"))
    .join("\r\n\r\n");
}
