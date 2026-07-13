import { describe, expect, it } from "vitest";
import { attainmentSummary } from "@/lib/derived";
import { normalizeItem } from "@/lib/normalize";
import type { Item } from "@/lib/types";
import { makeItem } from "./factory";

// normalizeItem is the single reconciliation point between the metrics[] array
// (source of truth) and the legacy scalar metric columns (mirror of metrics[0]).
describe("normalizeItem — metrics reconciliation", () => {
  it("respects a provided metrics array and mirrors metrics[0] into the scalar fields", () => {
    const item = normalizeItem({
      itemType: "x",
      metrics: [
        { id: "m1", name: "เข้าถึง", unit: "ครั้ง", targetValue: 100, actualValue: 120 },
        { id: "m2", name: "คลิก", unit: "ครั้ง", targetValue: 10, actualValue: 8 },
      ],
    });
    expect(item.metrics).toHaveLength(2);
    expect(item.metricName).toBe("เข้าถึง");
    expect(item.metricUnit).toBe("ครั้ง");
    expect(item.targetValue).toBe(100);
    expect(item.actualValue).toBe(120);
  });

  it("synthesizes one metric from the legacy scalar fields when metrics is absent", () => {
    const item = normalizeItem({
      itemType: "x",
      metricName: "วิว",
      metricUnit: "ครั้ง",
      targetValue: 5,
      actualValue: 4,
    });
    expect(item.metrics).toEqual([
      expect.objectContaining({ name: "วิว", unit: "ครั้ง", targetValue: 5, actualValue: 4 }),
    ]);
  });

  it("respects an explicitly empty metrics array (does not resurrect from scalars)", () => {
    const item = normalizeItem({
      itemType: "x",
      metrics: [],
      metricName: "วิว",
      targetValue: 5,
      actualValue: 4,
    });
    expect(item.metrics).toEqual([]);
    expect(item.metricName).toBe("");
    expect(item.targetValue).toBeNull();
  });

  it("drops fully-empty metric rows", () => {
    const item = normalizeItem({
      itemType: "x",
      metrics: [
        { id: "m1", name: "", unit: "", targetValue: null, actualValue: null },
        { id: "m2", name: "จอง", unit: "", targetValue: 3, actualValue: 2 },
      ],
    });
    expect(item.metrics).toHaveLength(1);
    expect(item.metrics[0].name).toBe("จอง");
  });
});

describe("normalizeItem — subtasks", () => {
  it("reconciles the legacy `text`/no-assignee shape and defaults new fields", () => {
    const item = normalizeItem({
      itemType: "x",
      // legacy pre-subtask entries: `text` instead of `title`, no assignee/dates
      checklist: [
        { id: "c1", text: "ถ่ายรูป", done: false },
        { id: "c2", text: "ตัดต่อ", done: true, assignee: "พี่ก้อย" },
      ] as unknown as Item["checklist"],
    });
    expect(item.checklist[0].title).toBe("ถ่ายรูป");
    expect(item.checklist[0].assignee).toBe("");
    expect(item.checklist[0].description).toBe("");
    expect(item.checklist[0].startDate).toBe("");
    expect(item.checklist[0].dueDate).toBe("");
    expect(item.checklist[1].title).toBe("ตัดต่อ");
    expect(item.checklist[1].assignee).toBe("พี่ก้อย");
  });

  it("keeps a full subtask (title/description/assignee/dates) intact", () => {
    const item = normalizeItem({
      itemType: "x",
      checklist: [
        {
          id: "c1",
          title: "เขียนบท",
          description: "ร่าง 2 เวอร์ชัน",
          done: false,
          assignee: "พี่ไซน์",
          startDate: "2026-03-01",
          dueDate: "2026-03-05",
        },
      ],
    });
    expect(item.checklist[0]).toEqual({
      id: "c1",
      title: "เขียนบท",
      description: "ร่าง 2 เวอร์ชัน",
      done: false,
      assignee: "พี่ไซน์",
      startDate: "2026-03-01",
      dueDate: "2026-03-05",
    });
  });
});

describe("attainmentSummary — multiple metrics per item", () => {
  it("counts each metric of an item into its own metric+unit group", () => {
    const items = [
      makeItem({
        id: "a",
        metrics: [
          { id: "m1", name: "เข้าถึง", unit: "ครั้ง", targetValue: 100, actualValue: 120 },
          { id: "m2", name: "คลิก", unit: "ครั้ง", targetValue: 10, actualValue: 5 },
        ],
      }),
    ];
    const summary = attainmentSummary(items);
    // one item, measured once (coverage), but two metric groups
    expect(summary.measured).toBe(1);
    expect(summary.groups).toHaveLength(2);
    expect(summary.groups.find((g) => g.metric === "เข้าถึง")?.attainmentPct).toBe(120);
    expect(summary.groups.find((g) => g.metric === "คลิก")?.attainmentPct).toBe(50);
  });
});
