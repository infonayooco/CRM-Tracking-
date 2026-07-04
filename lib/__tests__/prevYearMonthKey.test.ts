import { describe, expect, it } from "vitest";
import { prevYearMonthKey } from "@/lib/derived";

describe("prevYearMonthKey — YoY comparison-basis month key", () => {
  it("returns the same month, one year earlier", () => {
    expect(prevYearMonthKey("2026-06")).toBe("2025-06");
  });

  it("handles January without rolling back to the wrong year (unlike prevMonthKey)", () => {
    expect(prevYearMonthKey("2026-01")).toBe("2025-01");
  });

  it("returns '' for a malformed key", () => {
    expect(prevYearMonthKey("not-a-month")).toBe("");
    expect(prevYearMonthKey("")).toBe("");
    expect(prevYearMonthKey("2026-13")).toBe("");
    expect(prevYearMonthKey("2026-00")).toBe("");
  });
});
