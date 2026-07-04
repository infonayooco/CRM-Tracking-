import { afterEach, describe, expect, it } from "vitest";
import { useStore } from "@/lib/store";
import { makeCustomer } from "./factory";

describe("upsertCustomer — reusing an existing customer preserves its stored fields", () => {
  afterEach(() => {
    useStore.setState({ customers: [], items: [], members: [] });
  });

  // Regression (BUG 1): upsertCustomer used to spread `...normalized` after
  // `...existing`, and normalizeCustomer fills every unspecified field with a
  // blank default (contactPerson/phone/lineId: "", color: default, createdAt:
  // now) — so reusing an existing customer by name clobbered its real contact
  // details and reset createdAt. Only name/province/salesOwner should update,
  // and only when a non-empty value is supplied.
  it("keeps contactPerson/phone/lineId/color/createdAt intact and reuses the same record (no duplicate)", () => {
    const originalCreatedAt = "2021-05-01T00:00:00.000Z";
    useStore.setState({
      customers: [
        makeCustomer({
          id: "c1",
          name: "ลูกค้าเดิม",
          province: "ขอนแก่น",
          salesOwner: "พี่ไซน์",
          contactPerson: "คุณเอ",
          phone: "081-234-5678",
          lineId: "@customerA",
          color: "#ff0000",
          createdAt: originalCreatedAt,
        }),
      ],
      items: [],
      members: ["พี่ไซน์"],
    });

    const returnedId = useStore.getState().upsertCustomer({
      name: "ลูกค้าเดิม",
      province: "",
      salesOwner: "",
    });

    const state = useStore.getState();
    expect(returnedId).toBe("c1");
    expect(state.customers).toHaveLength(1); // reused, not duplicated

    const stored = state.customers.find((customer) => customer.id === "c1")!;
    expect(stored.contactPerson).toBe("คุณเอ");
    expect(stored.phone).toBe("081-234-5678");
    expect(stored.lineId).toBe("@customerA");
    expect(stored.color).toBe("#ff0000");
    expect(stored.createdAt).toBe(originalCreatedAt);
    // province/salesOwner left blank in the incoming payload => keep existing
    expect(stored.province).toBe("ขอนแก่น");
    expect(stored.salesOwner).toBe("พี่ไซน์");
  });

  it("updates name/province/salesOwner when a non-empty value is supplied, without touching other fields", () => {
    // province starts blank so the match-by-name-and-compatible-province logic
    // (in upsertCustomer) still reuses this record when a non-empty province is
    // supplied — supplying a DIFFERENT non-empty province than an existing
    // non-empty one is a deliberate non-match (a different customer), which is
    // separate, pre-existing behavior this fix does not touch.
    const originalCreatedAt = "2021-05-01T00:00:00.000Z";
    useStore.setState({
      customers: [
        makeCustomer({
          id: "c1",
          name: "ลูกค้าเดิม",
          province: "",
          salesOwner: "พี่ไซน์",
          contactPerson: "คุณเอ",
          phone: "081-234-5678",
          lineId: "@customerA",
          color: "#ff0000",
          createdAt: originalCreatedAt,
        }),
      ],
      items: [],
      members: ["พี่ไซน์"],
    });

    const returnedId = useStore.getState().upsertCustomer({
      name: "ลูกค้าเดิม",
      province: "อุดรธานี",
      salesOwner: "พี่บอส",
    });

    const state = useStore.getState();
    expect(returnedId).toBe("c1");
    expect(state.customers).toHaveLength(1);

    const stored = state.customers.find((customer) => customer.id === "c1")!;
    expect(stored.province).toBe("อุดรธานี");
    expect(stored.salesOwner).toBe("พี่บอส");
    expect(stored.contactPerson).toBe("คุณเอ");
    expect(stored.phone).toBe("081-234-5678");
    expect(stored.lineId).toBe("@customerA");
    expect(stored.color).toBe("#ff0000");
    expect(stored.createdAt).toBe(originalCreatedAt);
  });

  it("creates a brand-new customer (no existing match) using the normalized fields as-is", () => {
    useStore.setState({ customers: [], items: [], members: [] });

    const returnedId = useStore.getState().upsertCustomer({
      name: "ลูกค้าใหม่",
      province: "เชียงใหม่",
      salesOwner: "พี่แนน",
    });

    const state = useStore.getState();
    expect(state.customers).toHaveLength(1);
    const stored = state.customers.find((customer) => customer.id === returnedId)!;
    expect(stored.name).toBe("ลูกค้าใหม่");
    expect(stored.province).toBe("เชียงใหม่");
    expect(stored.salesOwner).toBe("พี่แนน");
    expect(stored.contactPerson).toBe("");
    expect(stored.phone).toBe("");
    expect(stored.lineId).toBe("");
  });
});
