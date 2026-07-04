import { CHANNEL_MAP, EXEC_MAP, REPORT_MAP, RESULT_MAP } from "./constants";
import type { Customer, Item } from "./types";

const TEAM_CSV_HEADERS = [
  "จังหวัด",
  "ชื่อลูกค้า",
  "เลขใบเสนอราคา (QT)",
  "เลขที่ใบวางบิล (INV)",
  "เจ้าของงานขาย ",
  "ช่องทาง",
  "รายการ",
  "รายละเอียด",
  "ราคา VAT7%",
  "การดำเนินการ",
  "สถานะ Ads",
  "เป้าหมาย ที่ต้องการ",
  "ผลลัพธ์ที่เกิดขึ้น",
  "ผลลัพธ์",
  "Link งาน",
  "Deadline งานสื่อสารก่อนเผยแพร่",
  "Publish Date",
  "Finished Date",
  "การจัดส่งรีพอร์ต",
  "คะแนนการประเมิน",
] as const;

export function escapeCsv(v: unknown) {
  let text = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function serializeTeamCsv(customers: Customer[], items: Item[]) {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const rows = items.map((item) => {
    const customer = customerById.get(item.customerId);

    return [
      customer?.province || "",
      customer?.name || "",
      item.qtNo,
      item.invNo,
      customer?.salesOwner || "",
      (CHANNEL_MAP[item.channel] || CHANNEL_MAP.other).label,
      item.itemType,
      item.detail,
      item.price === null ? "" : item.price,
      (EXEC_MAP[item.execStatus] || EXEC_MAP.not_started).label,
      "",
      item.target,
      item.actual,
      (RESULT_MAP[item.resultStatus] || RESULT_MAP.not_collected).label,
      item.link,
      // ISO dates are intentionally exported instead of d-Mon-yyyy for stable round-tripping.
      item.deadline || "",
      item.publishDate || "",
      item.finishedDate || "",
      (REPORT_MAP[item.reportStatus] || REPORT_MAP.not_sent).label,
      "⭐️".repeat(item.rating || 0),
    ];
  });

  return [TEAM_CSV_HEADERS, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

export function downloadFile(filename: string, content: string, mime: string) {
  // Excel reads a UTF-8 CSV as the OS legacy encoding unless it sees a BOM, which
  // mojibakes Thai text. Prepend a BOM for CSV downloads only (JSON stays clean).
  const needsBom = mime.includes("csv") && !content.startsWith("\uFEFF");
  const blob = new Blob([needsBom ? `\uFEFF${content}` : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
