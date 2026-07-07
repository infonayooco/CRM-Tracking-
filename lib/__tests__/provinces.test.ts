import { describe, expect, it } from "vitest";
import {
  PROVINCES,
  PROVINCE_BY_CODE,
  PROVINCE_CODE_BY_TH,
  provinceNameTh,
} from "@/lib/provinces";

describe("PROVINCES reference data", () => {
  it("has exactly 77 provinces", () => {
    expect(PROVINCES).toHaveLength(77);
  });

  it("has unique ISO 3166-2:TH codes in the TH-NN format", () => {
    const codes = PROVINCES.map((province) => province.code);
    expect(new Set(codes).size).toBe(77);
    for (const code of codes) expect(code).toMatch(/^TH-\d{2}$/);
  });

  it("has unique, non-empty, trimmed Thai and English names", () => {
    expect(new Set(PROVINCES.map((province) => province.th)).size).toBe(77);
    expect(new Set(PROVINCES.map((province) => province.en)).size).toBe(77);
    for (const province of PROVINCES) {
      expect(province.th.trim()).toBe(province.th);
      expect(province.th.length).toBeGreaterThan(0);
      expect(province.en.trim()).toBe(province.en);
      expect(province.en.length).toBeGreaterThan(0);
    }
  });

  it("maps anchor provinces by code and by Thai name (both directions agree)", () => {
    expect(PROVINCE_BY_CODE["TH-10"].th).toBe("กรุงเทพมหานคร");
    expect(PROVINCE_BY_CODE["TH-40"].th).toBe("ขอนแก่น");
    expect(PROVINCE_CODE_BY_TH["ขอนแก่น"]).toBe("TH-40");
    expect(PROVINCE_CODE_BY_TH["อุดรธานี"]).toBe("TH-41");
    expect(PROVINCE_CODE_BY_TH["บึงกาฬ"]).toBe("TH-38");
    expect(PROVINCE_CODE_BY_TH["ภูเก็ต"]).toBe("TH-83");
    // round-trips for every row
    for (const province of PROVINCES) {
      expect(PROVINCE_CODE_BY_TH[province.th]).toBe(province.code);
      expect(PROVINCE_BY_CODE[province.code].th).toBe(province.th);
    }
  });

  it("resolves display names and handles unset/unknown codes", () => {
    expect(provinceNameTh("TH-83")).toBe("ภูเก็ต");
    expect(provinceNameTh("")).toBe("");
    expect(provinceNameTh(null)).toBe("");
    expect(provinceNameTh(undefined)).toBe("");
    expect(provinceNameTh("TH-99")).toBe("");
  });
});
