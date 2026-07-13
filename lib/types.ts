export type ExecStatus = "not_started" | "in_progress" | "published" | "done";
export type ResultStatus = "not_collected" | "in_progress" | "achieved";
export type ReportStatus = "not_sent" | "sent";
export type RenewalStatus = "pending" | "renewed" | "lost";
export type ChannelKey =
  | "facebook"
  | "web"
  | "google"
  | "line"
  | "tiktok"
  | "youtube"
  | "other";
export type PriorityKey = "high" | "medium" | "low";
export type StatusDimKey = "exec" | "result" | "report";
export type ViewKey = "items" | "calendar" | "customers" | "report";
export type CalDateField = "publishDate" | "deadline" | "finishedDate";

export type InteractionType = "call" | "meeting" | "line" | "email" | "note";

export interface CustomerInteraction {
  id: string;
  date: string;
  type: InteractionType;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  /**
   * Thai province name — kept as the display/search/filter value and derived
   * from provinceCode when a code is set (see normalizeCustomer). Legacy
   * free-text that matches no known province is preserved until re-edited.
   */
  province: string;
  /** ISO 3166-2:TH province code (e.g. "TH-40"); "" when unset/unmatched. */
  provinceCode: string;
  salesOwner: string;
  contactPerson: string;
  phone: string;
  email: string;
  lineId: string;
  color: string;
  createdAt: string;
  interactions: CustomerInteraction[];
}

export interface Metric {
  id: string;
  /** Metric label, e.g. "ยอดเข้าถึง". */
  name: string;
  /** Unit, e.g. "ครั้ง" / "%". */
  unit: string;
  targetValue: number | null;
  actualValue: number | null;
}

export interface Item {
  id: string;
  customerId: string;
  qtNo: string;
  invNo: string;
  channel: ChannelKey;
  itemType: string;
  detail: string;
  price: number | null;
  execStatus: ExecStatus;
  resultStatus: ResultStatus;
  reportStatus: ReportStatus;
  renewalStatus: RenewalStatus;
  target: string;
  actual: string;
  /**
   * Multiple close-out metrics. Source of truth for the metric list; the scalar
   * metricName/metricUnit/targetValue/actualValue below mirror metrics[0] for
   * backward-compat (DB scalar columns, legacy readers). See normalizeItem.
   */
  metrics: Metric[];
  metricName: string;
  metricUnit: string;
  targetValue: number | null;
  actualValue: number | null;
  reportSentDate: string;
  link: string;
  rating: number;
  deadline: string;
  publishDate: string;
  finishedDate: string;
  notes: string;
  followUpDate: string;
  followUpNote: string;
  priority: PriorityKey;
  progress: number;
  checklist: { id: string; text: string; done: boolean; assignee: string }[];
  activity: { ts: string; text: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  version: number;
  customers: Customer[];
  items: Item[];
  members: string[];
  settings: { currentUser: string };
}

export interface Filters {
  q: string;
  customerId: string;
  qtNo: string;
  channel: string;
  itemType: string;
  salesOwner: string;
  province: string;
  statusKey: string;
  mine: boolean;
  overdue: boolean;
  dateFrom: string;
  dateTo: string;
}

export interface StatusDef<T extends string> {
  key: T;
  label: string;
  icon: string;
  dot: string;
  badge: string;
  ring: string;
}

export interface ChannelDef {
  key: ChannelKey;
  label: string;
  icon: string;
  color: string;
  brand?: boolean;
}

export interface PriorityDef {
  key: PriorityKey;
  label: string;
  rank: number;
  badge: string;
  dot: string;
}
