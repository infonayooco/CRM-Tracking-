import { describe, expect, it } from "vitest";
import { normalizeCustomer } from "@/lib/normalize";

describe("normalizeCustomer (#7) — contact fields (contactPerson/phone/email/lineId)", () => {
  it("defaults all contact fields to '' for legacy data with no contact fields", () => {
    const result = normalizeCustomer({ name: "X" });
    expect(result.contactPerson).toBe("");
    expect(result.phone).toBe("");
    expect(result.email).toBe("");
    expect(result.lineId).toBe("");
  });

  it("trims and keeps contact fields when provided", () => {
    const result = normalizeCustomer({
      name: "X",
      phone: "  081-234  ",
      contactPerson: "คุณเอ",
      email: "  sales@example.com  ",
      lineId: "@shop",
    });
    expect(result.contactPerson).toBe("คุณเอ");
    expect(result.phone).toBe("081-234");
    expect(result.email).toBe("sales@example.com");
    expect(result.lineId).toBe("@shop");
  });
});
