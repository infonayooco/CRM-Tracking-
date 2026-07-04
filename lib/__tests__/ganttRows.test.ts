import { describe, expect, it } from "vitest";
import { buildGanttRows } from "@/lib/derived";
import { EXEC_MAP } from "@/lib/constants";
import { makeCustomer, makeItem } from "./factory";

describe("buildGanttRows", () => {
  it("builds a row from an item's publishDate/finishedDate with the exec-status color", () => {
    const customer = makeCustomer({ id: "c1", name: "บริษัท เอบีซี" });
    const item = makeItem({
      id: "a",
      customerId: "c1",
      itemType: "วิดีโอโปรโมท",
      execStatus: "published",
      publishDate: "2026-01-01",
      finishedDate: "2026-01-10",
    });

    const rows = buildGanttRows([item], [customer]);

    expect(rows).toHaveLength(1);
    expect(rows[0].label).toBe("วิดีโอโปรโมท · บริษัท เอบีซี");
    expect(rows[0].start).toBe(new Date("2026-01-01").setHours(0, 0, 0, 0));
    expect(rows[0].end).toBe(new Date("2026-01-10").setHours(0, 0, 0, 0));
    expect(rows[0].color).toBe(EXEC_MAP.published.dot);
    expect(rows[0].item).toBe(item);
  });

  it("falls back to createdAt for start and deadline for end when publishDate/finishedDate are blank", () => {
    const customer = makeCustomer({ id: "c1" });
    const item = makeItem({
      id: "b",
      customerId: "c1",
      publishDate: "",
      finishedDate: "",
      deadline: "2026-02-05",
      createdAt: "2026-02-01T00:00:00.000Z",
    });

    const rows = buildGanttRows([item], [customer]);

    expect(rows).toHaveLength(1);
    expect(rows[0].start).toBe(new Date("2026-02-01T00:00:00.000Z").setHours(0, 0, 0, 0));
    expect(rows[0].end).toBe(new Date("2026-02-05").setHours(0, 0, 0, 0));
  });

  it("falls back to a start+1day placeholder when neither finishedDate nor deadline is set", () => {
    const customer = makeCustomer({ id: "c1" });
    const item = makeItem({
      id: "c",
      customerId: "c1",
      publishDate: "2026-03-01",
      finishedDate: "",
      deadline: "",
    });

    const rows = buildGanttRows([item], [customer]);

    expect(rows).toHaveLength(1);
    expect(rows[0].end - rows[0].start).toBe(86400000);
  });

  it("skips items with no resolvable start date", () => {
    const customer = makeCustomer({ id: "c1" });
    const item = makeItem({
      id: "d",
      customerId: "c1",
      publishDate: "",
      finishedDate: "",
      deadline: "",
      createdAt: "not-a-date",
    });

    const rows = buildGanttRows([item], [customer]);

    expect(rows).toHaveLength(0);
  });

  it("skips items where the computed end is <= start", () => {
    const customer = makeCustomer({ id: "c1" });
    const item = makeItem({
      id: "e",
      customerId: "c1",
      publishDate: "2026-04-10",
      finishedDate: "2026-04-01", // before publishDate — invalid range
      deadline: "",
    });

    const rows = buildGanttRows([item], [customer]);

    expect(rows).toHaveLength(0);
  });

  it("orders rows by customer name by default", () => {
    const customerA = makeCustomer({ id: "ca", name: "ลูกค้า Z" });
    const customerB = makeCustomer({ id: "cb", name: "ลูกค้า A" });
    const itemA = makeItem({ id: "ia", customerId: "ca", publishDate: "2026-01-01", finishedDate: "" });
    const itemB = makeItem({ id: "ib", customerId: "cb", publishDate: "2026-01-01", finishedDate: "" });

    const rows = buildGanttRows([itemA, itemB], [customerA, customerB]);

    expect(rows.map((row) => row.item.id)).toEqual(["ib", "ia"]);
  });

  it("maps each exec status to its own dot color", () => {
    const customer = makeCustomer({ id: "c1" });
    const items = [
      makeItem({ id: "1", customerId: "c1", execStatus: "not_started", publishDate: "2026-01-01", finishedDate: "" }),
      makeItem({ id: "2", customerId: "c1", execStatus: "in_progress", publishDate: "2026-01-01", finishedDate: "" }),
      makeItem({ id: "3", customerId: "c1", execStatus: "published", publishDate: "2026-01-01", finishedDate: "" }),
      makeItem({ id: "4", customerId: "c1", execStatus: "done", publishDate: "2026-01-01", finishedDate: "" }),
    ];

    const rows = buildGanttRows(items, [customer]);
    const colorById = new Map(rows.map((row) => [row.item.id, row.color]));

    expect(colorById.get("1")).toBe(EXEC_MAP.not_started.dot);
    expect(colorById.get("2")).toBe(EXEC_MAP.in_progress.dot);
    expect(colorById.get("3")).toBe(EXEC_MAP.published.dot);
    expect(colorById.get("4")).toBe(EXEC_MAP.done.dot);
  });
});
