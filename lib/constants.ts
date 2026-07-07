import type {
  ChannelDef,
  ExecStatus,
  PriorityDef,
  RenewalStatus,
  ReportStatus,
  ResultStatus,
  StatusDef,
  StatusDimKey,
} from "./types";

export const STORAGE_KEY = "teamTaskTracker.v2";
export const STORE_VERSION = 2;

export const EXEC_STATUS = [
  {
    key: "not_started",
    label: "ยังไม่เริ่ม",
    icon: "Hourglass",
    dot: "#7c8fac",
    badge: "bg-slate-100 text-slate-600",
    ring: "#7c8fac",
  },
  {
    key: "in_progress",
    label: "กำลังดำเนินการ",
    icon: "PersonStanding",
    dot: "#539bff",
    badge: "bg-info-light text-info-dark",
    ring: "#539bff",
  },
  {
    key: "published",
    label: "เผยแพร่แล้ว",
    icon: "Megaphone",
    dot: "#5d87ff",
    badge: "bg-primary-light text-primary-dark",
    ring: "#5d87ff",
  },
  {
    key: "done",
    label: "เสร็จแล้ว",
    icon: "CircleCheck",
    dot: "#13deb9",
    badge: "bg-success-light text-success-dark",
    ring: "#13deb9",
  },
] as const satisfies readonly StatusDef<ExecStatus>[];

export const RESULT_STATUS = [
  {
    key: "not_collected",
    label: "ยังไม่เก็บผลลัพธ์",
    icon: "Clock",
    dot: "#7c8fac",
    badge: "bg-slate-100 text-slate-600",
    ring: "#7c8fac",
  },
  {
    key: "in_progress",
    label: "กำลังเก็บผลลัพธ์",
    icon: "ChartLine",
    dot: "#ffae1f",
    badge: "bg-warning-light text-warning-dark",
    ring: "#ffae1f",
  },
  {
    key: "achieved",
    label: "บรรลุผลลัพธ์",
    icon: "CircleCheck",
    dot: "#13deb9",
    badge: "bg-success-light text-success-dark",
    ring: "#13deb9",
  },
] as const satisfies readonly StatusDef<ResultStatus>[];

export const REPORT_STATUS = [
  {
    key: "not_sent",
    label: "ยังไม่จัดส่งรีพอร์ต",
    icon: "Send",
    dot: "#7c8fac",
    badge: "bg-slate-100 text-slate-600",
    ring: "#7c8fac",
  },
  {
    key: "sent",
    label: "จัดส่งรีพอร์ตเรียบร้อย",
    icon: "Send",
    dot: "#13deb9",
    badge: "bg-success-light text-success-dark",
    ring: "#13deb9",
  },
] as const satisfies readonly StatusDef<ReportStatus>[];

export const EXEC_MAP = Object.fromEntries(EXEC_STATUS.map((s) => [s.key, s])) as Record<
  ExecStatus,
  (typeof EXEC_STATUS)[number]
>;
export const RESULT_MAP = Object.fromEntries(
  RESULT_STATUS.map((s) => [s.key, s]),
) as Record<ResultStatus, (typeof RESULT_STATUS)[number]>;
export const REPORT_MAP = Object.fromEntries(
  REPORT_STATUS.map((s) => [s.key, s]),
) as Record<ReportStatus, (typeof REPORT_STATUS)[number]>;

// Renewal lifecycle for a campaign after it reaches its expiry (finishedDate).
// Labels mirror the wording already used in ReportView's renewal panel.
export const RENEWAL_STATUS = [
  { key: "pending", label: "รอต่ออายุ", badge: "bg-slate-100 text-slate-600", dot: "#7c8fac" },
  { key: "renewed", label: "ต่ออายุแล้ว", badge: "bg-success-light text-success-dark", dot: "#13deb9" },
  { key: "lost", label: "ไม่ต่อ / เสียลูกค้า", badge: "bg-error-light text-error-dark", dot: "#fa896b" },
] as const satisfies readonly { key: RenewalStatus; label: string; badge: string; dot: string }[];

export const RENEWAL_MAP = Object.fromEntries(RENEWAL_STATUS.map((s) => [s.key, s])) as Record<
  RenewalStatus,
  (typeof RENEWAL_STATUS)[number]
>;

export const STATUS_DIMS = {
  exec: {
    key: "exec",
    label: "การดำเนินการ",
    field: "execStatus",
    list: EXEC_STATUS,
    map: EXEC_MAP,
    fallback: "not_started",
  },
  result: {
    key: "result",
    label: "ผลลัพธ์",
    field: "resultStatus",
    list: RESULT_STATUS,
    map: RESULT_MAP,
    fallback: "not_collected",
  },
  report: {
    key: "report",
    label: "รีพอร์ต",
    field: "reportStatus",
    list: REPORT_STATUS,
    map: REPORT_MAP,
    fallback: "not_sent",
  },
} as const;

export const STATUS_DIM_KEYS = ["exec", "result", "report"] as const satisfies readonly StatusDimKey[];

export const PRIORITY = [
  {
    key: "high",
    label: "สูง",
    rank: 3,
    badge: "bg-error-light text-error-dark",
    dot: "#fa896b",
  },
  {
    key: "medium",
    label: "กลาง",
    rank: 2,
    badge: "bg-warning-light text-warning-dark",
    dot: "#ffae1f",
  },
  {
    key: "low",
    label: "ต่ำ",
    rank: 1,
    badge: "bg-slate-100 text-slate-600",
    dot: "#7c8fac",
  },
] as const satisfies readonly PriorityDef[];

export const PRIORITY_MAP = Object.fromEntries(PRIORITY.map((p) => [p.key, p])) as Record<
  (typeof PRIORITY)[number]["key"],
  (typeof PRIORITY)[number]
>;

export const CHANNEL = [
  { key: "facebook", label: "Facebook", icon: "MessagesSquare", color: "#1877F2", brand: true },
  { key: "web", label: "Web", icon: "Globe", color: "#f97316" },
  { key: "google", label: "Google", icon: "Search", color: "#16a34a", brand: true },
  { key: "line", label: "LINE OA", icon: "MessageCircle", color: "#06C755", brand: true },
  { key: "tiktok", label: "TikTok", icon: "Music2", color: "#111827", brand: true },
  { key: "youtube", label: "YouTube", icon: "Youtube", color: "#FF0000", brand: true },
  { key: "other", label: "อื่นๆ", icon: "Ellipsis", color: "#64748b" },
] as const satisfies readonly ChannelDef[];

export const CHANNEL_MAP = Object.fromEntries(CHANNEL.map((c) => [c.key, c])) as Record<
  (typeof CHANNEL)[number]["key"],
  (typeof CHANNEL)[number]
>;

export const AVATAR_COLORS = [
  "#5d87ff",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#4f46e5",
  "#db2777",
] as const;

export const CUSTOMER_COLORS = [
  "#5d87ff",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#e11d48",
  "#0891b2",
  "#4f46e5",
  "#0d9488",
] as const;

export const THAI_MONTHS = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
] as const;

export const THAI_MONTHS_FULL = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
] as const;

export const MONTHS_EN: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
