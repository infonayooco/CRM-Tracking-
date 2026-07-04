import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

function seed() {
  useStore.setState({
    customers: [makeCustomer({ id: "c1", name: "A" })],
    items: [
      makeItem({
        id: "a",
        customerId: "c1",
        execStatus: "not_started",
        reportStatus: "not_sent",
        reportSentDate: "",
        activity: [],
      }),
      makeItem({
        id: "b",
        customerId: "c1",
        execStatus: "not_started",
        reportStatus: "not_sent",
        reportSentDate: "",
        activity: [],
      }),
      makeItem({
        id: "c",
        customerId: "c1",
        execStatus: "not_started",
        reportStatus: "not_sent",
        reportSentDate: "",
        activity: [],
      }),
    ],
  });
}

describe("updateItems (batch)", () => {
  beforeEach(() => {
    seed();
  });

  afterEach(() => {
    useStore.setState({ items: [], customers: [] });
  });

  it("patches every item whose id is in the batch, leaving the rest untouched", () => {
    useStore.getState().updateItems(["a", "b"], { execStatus: "published" });

    const items = useStore.getState().items;
    expect(items.find((item) => item.id === "a")?.execStatus).toBe("published");
    expect(items.find((item) => item.id === "b")?.execStatus).toBe("published");
    expect(items.find((item) => item.id === "c")?.execStatus).toBe("not_started");
  });

  it("auto-stamps reportSentDate for items with none when reportStatus flips to sent", () => {
    useStore.getState().updateItems(["a", "b"], { reportStatus: "sent" });

    const items = useStore.getState().items;
    expect(items.find((item) => item.id === "a")?.reportSentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(items.find((item) => item.id === "b")?.reportSentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // untouched item keeps neither the new status nor a stamped date
    expect(items.find((item) => item.id === "c")?.reportStatus).toBe("not_sent");
    expect(items.find((item) => item.id === "c")?.reportSentDate).toBe("");
  });

  it("appends an activity entry and bumps updatedAt for each patched item", () => {
    const before = useStore.getState().items.find((item) => item.id === "a")!;
    expect(before.activity).toHaveLength(0);

    useStore.getState().updateItems(["a"], { execStatus: "published" });

    const after = useStore.getState().items.find((item) => item.id === "a")!;
    expect(after.activity).toHaveLength(before.activity.length + 1);
    expect(after.updatedAt).not.toBe(before.updatedAt);
  });

  it("is a no-op when given an empty ids array", () => {
    useStore.getState().updateItems([], { execStatus: "published" });

    const items = useStore.getState().items;
    expect(items.every((item) => item.execStatus === "not_started")).toBe(true);
  });
});
