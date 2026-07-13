import { describe, expect, it } from "vitest";
import { normalizeCustomer } from "@/lib/normalize";

// normalizeCustomer is the single reconciliation point between the province code
// (written by the Phase 3 picker) and the legacy free-text province name (kept as
// the display/search/filter value). These cases pin the sync direction.
describe("normalizeCustomer province reconciliation", () => {
  it("derives the Thai name from a valid code (code wins)", () => {
    // Even when the incoming text disagrees, a valid code is authoritative — this
    // is what closes the migration's stale-on-edit gap.
    const c = normalizeCustomer({ name: "ก", provinceCode: "TH-41", province: "ขอนแก่น" });
    expect(c.provinceCode).toBe("TH-41");
    expect(c.province).toBe("อุดรธานี");
  });

  it("backfills the code from a matching legacy Thai name", () => {
    const c = normalizeCustomer({ name: "ข", province: "เชียงใหม่" });
    expect(c.provinceCode).toBe("TH-50");
    expect(c.province).toBe("เชียงใหม่");
  });

  it("preserves unmatched legacy free-text with an empty code", () => {
    const c = normalizeCustomer({ name: "ค", province: "เมืองสมมติ" });
    expect(c.provinceCode).toBe("");
    expect(c.province).toBe("เมืองสมมติ");
  });

  it("ignores an unknown code and falls back to the name", () => {
    const c = normalizeCustomer({ name: "ง", provinceCode: "TH-99", province: "ภูเก็ต" });
    expect(c.provinceCode).toBe("TH-83");
    expect(c.province).toBe("ภูเก็ต");
  });

  it("leaves both empty when neither is provided", () => {
    const c = normalizeCustomer({ name: "จ" });
    expect(c.provinceCode).toBe("");
    expect(c.province).toBe("");
  });
});
