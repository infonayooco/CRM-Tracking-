import type { Customer, Item } from "@/lib/types";

// Shared test fixtures. The derived functions under test read only a handful of
// fields, so these factories fill valid defaults and let each test state only
// what matters. (Not a *.test file, so vitest won't collect it as a suite.)
export function makeItem(overrides: Partial<Item> = {}): Item {
  const item: Item = {
    id: "item-x",
    customerId: "c1",
    qtNo: "",
    invNo: "",
    channel: "web",
    itemType: "งานทดสอบ",
    detail: "",
    price: 0,
    execStatus: "done",
    resultStatus: "achieved",
    reportStatus: "sent",
    renewalStatus: "pending",
    target: "",
    actual: "",
    metrics: [],
    metricName: "",
    metricUnit: "",
    targetValue: null,
    actualValue: null,
    reportSentDate: "",
    link: "",
    rating: 0,
    deadline: "",
    publishDate: "",
    finishedDate: "2020-01-01",
    notes: "",
    followUpDate: "",
    followUpNote: "",
    priority: "medium",
    progress: 100,
    checklist: [],
    activity: [],
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
    ...overrides,
  };
  // Mirror scalar metric fields into metrics[] (like normalizeItem) so callers can
  // keep passing metricName/targetValue overrides; an explicit metrics override wins.
  if (!overrides.metrics) {
    item.metrics =
      item.metricName || item.metricUnit || item.targetValue != null || item.actualValue != null
        ? [
            {
              id: "metric-x",
              name: item.metricName,
              unit: item.metricUnit,
              targetValue: item.targetValue,
              actualValue: item.actualValue,
            },
          ]
        : [];
  }
  return item;
}

export function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "ลูกค้าทดสอบ",
    province: "ขอนแก่น",
    provinceCode: "TH-40",
    salesOwner: "พี่ไซน์",
    contactPerson: "",
    phone: "",
    email: "",
    lineId: "",
    color: "#2563eb",
    createdAt: "2020-01-01T00:00:00.000Z",
    interactions: [],
    ...overrides,
  };
}
