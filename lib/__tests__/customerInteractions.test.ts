import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { normalizeCustomer } from "@/lib/normalize";
import { useStore } from "@/lib/store";
import { makeCustomer } from "./factory";

function seed() {
  useStore.setState({
    customers: [makeCustomer({ id: "c1", name: "A", interactions: [] })],
  });
}

describe("addInteraction / deleteInteraction", () => {
  beforeEach(() => {
    seed();
  });

  afterEach(() => {
    useStore.setState({ customers: [] });
  });

  it("prepends a normalized entry (newest first, id present, date defaulted, note trimmed)", () => {
    useStore.getState().addInteraction("c1", { type: "call", note: "  โทรคุยเรื่องต่ออายุ  " });

    const customer = useStore.getState().customers.find((c) => c.id === "c1");
    expect(customer?.interactions).toHaveLength(1);
    const entry = customer!.interactions[0];
    expect(entry.id).toBeTruthy();
    expect(entry.type).toBe("call");
    expect(entry.note).toBe("โทรคุยเรื่องต่ออายุ");
    expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    useStore.getState().addInteraction("c1", { type: "meeting", note: "นัดประชุมศุกร์นี้", date: "2024-05-01" });
    const afterSecond = useStore.getState().customers.find((c) => c.id === "c1")!;
    expect(afterSecond.interactions).toHaveLength(2);
    // newest first: the second call prepends ahead of the first
    expect(afterSecond.interactions[0].note).toBe("นัดประชุมศุกร์นี้");
    expect(afterSecond.interactions[0].date).toBe("2024-05-01");
    expect(afterSecond.interactions[1].note).toBe("โทรคุยเรื่องต่ออายุ");
  });

  it("is a no-op when the note is empty or whitespace", () => {
    useStore.getState().addInteraction("c1", { type: "note", note: "   " });
    useStore.getState().addInteraction("c1", { type: "note", note: "" });

    const customer = useStore.getState().customers.find((c) => c.id === "c1");
    expect(customer?.interactions).toEqual([]);
  });

  it("removes an interaction by id and leaves the others", () => {
    useStore.getState().addInteraction("c1", { type: "call", note: "โทรคุยครั้งที่ 1" });
    useStore.getState().addInteraction("c1", { type: "email", note: "ส่งอีเมลใบเสนอราคา" });

    const before = useStore.getState().customers.find((c) => c.id === "c1")!;
    expect(before.interactions).toHaveLength(2);
    const idToDelete = before.interactions[0].id;

    useStore.getState().deleteInteraction("c1", idToDelete);

    const after = useStore.getState().customers.find((c) => c.id === "c1")!;
    expect(after.interactions).toHaveLength(1);
    expect(after.interactions.some((entry) => entry.id === idToDelete)).toBe(false);
    expect(after.interactions[0].note).toBe("โทรคุยครั้งที่ 1");
  });

  it("normalizeCustomer defaults interactions to [] for legacy customers with none", () => {
    const normalized = normalizeCustomer({ name: "X" });
    expect(normalized.interactions).toEqual([]);
  });

  it("is a no-op for an unknown customerId", () => {
    useStore.getState().addInteraction("ghost", { type: "call", note: "ไม่ควรถูกเพิ่ม" });
    expect(useStore.getState().customers.find((c) => c.id === "c1")?.interactions).toEqual([]);

    useStore.getState().deleteInteraction("ghost", "any-id");
    expect(useStore.getState().customers).toHaveLength(1);
  });
});
