import { CHANNEL_MAP, CUSTOMER_COLORS, MONTHS_EN } from "./constants";
import { normalizeCustomer, normalizeItem } from "./normalize";
import type {
  ChannelKey,
  Customer,
  ExecStatus,
  Item,
  ReportStatus,
  ResultStatus,
} from "./types";

export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // strip a leading UTF-8 BOM (Excel-saved CSVs and our own BOM'd export carry one)
  const source = String(text).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);
  return rows.filter((candidate, index) => index < rows.length - 1 || candidate.some((cell) => cell.trim() !== ""));
}

export function thaiDateToIso(value: unknown) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return "";
  const month = MONTHS_EN[match[2].toLowerCase()];
  if (!month) return "";
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

export function parsePrice(value: unknown) {
  const text = String(value ?? "").replace(/,/g, "").trim();
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export function countStars(value: unknown) {
  return Math.min(5, (String(value || "").match(/⭐/gu) || []).length);
}

export function mapChannel(value: unknown): ChannelKey {
  const text = String(value || "").trim().toLowerCase();
  const aliases: Record<string, ChannelKey> = {
    facebook: "facebook",
    fb: "facebook",
    web: "web",
    website: "web",
    google: "google",
    line: "line",
    "line oa": "line",
    tiktok: "tiktok",
    "tik tok": "tiktok",
    youtube: "youtube",
    "you tube": "youtube",
    "อื่นๆ": "other",
    other: "other",
  };
  return aliases[text] || (text in CHANNEL_MAP ? (text as ChannelKey) : "other");
}

export function mapExec(value: unknown): ExecStatus {
  const mapping: Record<string, ExecStatus> = {
    "ยังไม่เริ่ม": "not_started",
    "กำลังดำเนินการ": "in_progress",
    "เผยแพร่แล้ว": "published",
    "ดำเนินการเสร็จแล้ว": "done",
    "เสร็จแล้ว": "done",
    not_started: "not_started",
    in_progress: "in_progress",
    published: "published",
    done: "done",
  };
  return mapping[String(value || "").trim()] || "not_started";
}

export function mapResult(value: unknown): ResultStatus {
  const mapping: Record<string, ResultStatus> = {
    "ยังไม่เก็บผลลัพธ์": "not_collected",
    "กำลังเก็บผลลัพธ์": "in_progress",
    "อยู่ระหว่างดำเนินการ": "in_progress",
    "บรรลุผลลัพธ์": "achieved",
    not_collected: "not_collected",
    in_progress: "in_progress",
    achieved: "achieved",
  };
  return mapping[String(value || "").trim()] || "not_collected";
}

export function mapReport(value: unknown): ReportStatus {
  const mapping: Record<string, ReportStatus> = {
    "ยังไม่จัดส่งรีพอร์ต": "not_sent",
    "จัดส่งรีพอร์ตเรียบร้อย": "sent",
    not_sent: "not_sent",
    sent: "sent",
  };
  return mapping[String(value || "").trim()] || "not_sent";
}

export function parseTeamCsv(text: string): {
  customers: Customer[];
  items: Item[];
  members: string[];
} {
  const rows = parseCsvRows(text);
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell.trim() === "ชื่อลูกค้า"));
  if (headerIndex < 0) throw new Error("ไม่พบหัวตาราง (ชื่อลูกค้า)");

  const header = rows[headerIndex].map((cell) => cell.replace(/\s+/g, " ").trim());
  const col = (name: string) => header.findIndex((cell) => cell === name.replace(/\s+/g, " ").trim());
  const idx = {
    province: col("จังหวัด"),
    name: col("ชื่อลูกค้า"),
    qt: col("เลขใบเสนอราคา (QT)"),
    inv: col("เลขที่ใบวางบิล (INV)"),
    owner: header.findIndex((cell) => cell.startsWith("เจ้าของงานขาย")),
    channel: col("ช่องทาง"),
    item: col("รายการ"),
    detail: col("รายละเอียด"),
    price: col("ราคา VAT7%"),
    exec: col("การดำเนินการ"),
    ads: col("สถานะ Ads"),
    target: header.findIndex((cell) => cell.startsWith("เป้าหมาย")),
    actual: col("ผลลัพธ์ที่เกิดขึ้น"),
    result: col("ผลลัพธ์"),
    link: col("Link งาน"),
    deadline: header.findIndex((cell) => cell.startsWith("Deadline")),
    publish: col("Publish Date"),
    finished: col("Finished Date"),
    report: col("การจัดส่งรีพอร์ต"),
    rating: col("คะแนนการประเมิน"),
  };

  const at = (row: string[], index: number) => (index >= 0 ? String(row[index] ?? "").trim() : "");
  const customers: Customer[] = [];
  const items: Item[] = [];
  const members = new Set<string>();
  const customerByKey = new Map<string, Customer>();
  let lastOwner = "";
  let lastReport: ReportStatus = "not_sent";
  let lastQtKey = "";

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || row.every((cell) => String(cell || "").trim() === "")) continue;

    const name = at(row, idx.name);
    const province = at(row, idx.province);
    if (!name) continue;

    const customerKey = `${name}||${province}`;
    let customer = customerByKey.get(customerKey);
    if (!customer) {
      customer = normalizeCustomer({
        name,
        province,
        color: CUSTOMER_COLORS[customerByKey.size % CUSTOMER_COLORS.length],
      });
      customerByKey.set(customerKey, customer);
      customers.push(customer);
    }

    const qtNo = at(row, idx.qt);
    const qtKey = `${customerKey}||${qtNo}`;
    let owner = at(row, idx.owner);
    if (owner) {
      lastOwner = owner;
    } else if (qtKey === lastQtKey) {
      owner = lastOwner;
    } else {
      owner = "";
      lastOwner = "";
    }

    const report = at(row, idx.report);
    let reportStatus: ReportStatus | "" = report ? mapReport(report) : "";
    if (report) {
      lastReport = reportStatus || "not_sent";
    } else if (qtKey === lastQtKey) {
      reportStatus = lastReport;
    } else {
      reportStatus = "not_sent";
      lastReport = "not_sent";
    }
    lastQtKey = qtKey;

    if (owner) {
      if (!customer.salesOwner) customer.salesOwner = owner;
      members.add(owner);
    }

    const invRaw = at(row, idx.inv);
    const invNo = invRaw === "ไม่มีข้อมูล" ? "" : invRaw;
    const ads = at(row, idx.ads);
    const notes = ads ? `สถานะ Ads: ${ads}` : "";
    const customerIds = new Set(customers.map((candidate) => candidate.id));

    items.push(
      normalizeItem(
        {
          customerId: customer.id,
          qtNo,
          invNo,
          channel: mapChannel(at(row, idx.channel)),
          itemType: at(row, idx.item) || "(ไม่ระบุรายการ)",
          detail: at(row, idx.detail),
          price: parsePrice(at(row, idx.price)),
          execStatus: mapExec(at(row, idx.exec)),
          resultStatus: mapResult(at(row, idx.result)),
          reportStatus: reportStatus || "not_sent",
          target: at(row, idx.target),
          actual: at(row, idx.actual),
          link: at(row, idx.link),
          rating: countStars(at(row, idx.rating)),
          deadline: thaiDateToIso(at(row, idx.deadline)),
          publishDate: thaiDateToIso(at(row, idx.publish)),
          finishedDate: thaiDateToIso(at(row, idx.finished)),
          notes,
        },
        customerIds,
      ),
    );
  }

  return { customers, items, members: [...members] };
}
