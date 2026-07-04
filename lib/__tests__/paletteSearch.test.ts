import { describe, expect, it } from "vitest";
import { filterPaletteCommands, type PaletteSearchable } from "@/lib/paletteSearch";

describe("filterPaletteCommands — command palette search + item cap", () => {
  it("returns every entry when the query is empty", () => {
    const commands: PaletteSearchable[] = [{ label: "ไปหน้า สิ่งที่ต้องทำ" }, { label: "ลูกค้า A" }];
    expect(filterPaletteCommands(commands, "")).toEqual(commands);
  });

  it("matches case-insensitively against the label", () => {
    const commands: PaletteSearchable[] = [{ label: "Export CSV" }, { label: "ลูกค้า A" }];
    expect(filterPaletteCommands(commands, "export")).toEqual([{ label: "Export CSV" }]);
  });

  it("matches against keywords even when the label doesn't contain the query", () => {
    const commands: PaletteSearchable[] = [
      { label: "บริษัท เอบีซี จำกัด", keywords: "บริษัท เอบีซี จำกัด ขอนแก่น สมชาย" },
      { label: "บริษัท อื่น จำกัด", keywords: "บริษัท อื่น จำกัด กรุงเทพ สมหญิง" },
    ];
    expect(filterPaletteCommands(commands, "ขอนแก่น")).toEqual([commands[0]]);
  });

  it("matches Thai text regardless of query case/locale folding", () => {
    const commands: PaletteSearchable[] = [{ label: "ไปหน้า ลูกค้า" }];
    expect(filterPaletteCommands(commands, "ลูกค้า")).toEqual(commands);
  });

  it("never caps non-item groups", () => {
    const customers: PaletteSearchable[] = Array.from({ length: 34 }, (_, index) => ({
      label: `ลูกค้า ${index}`,
      group: "customer",
    }));
    expect(filterPaletteCommands(customers, "", 20)).toHaveLength(34);
  });

  it("caps item-group entries to maxItemResults while keeping other groups intact", () => {
    const items: PaletteSearchable[] = Array.from({ length: 130 }, (_, index) => ({
      label: `ชิ้นงาน ${index}`,
      group: "item",
    }));
    const commands: PaletteSearchable[] = [{ label: "ไปหน้า สิ่งที่ต้องทำ" }, ...items];

    const result = filterPaletteCommands(commands, "", 20);

    expect(result).toHaveLength(1 + 20);
    expect(result[0]).toEqual({ label: "ไปหน้า สิ่งที่ต้องทำ" });
    expect(result.slice(1)).toEqual(items.slice(0, 20));
  });

  it("caps item matches under a search query too, preserving match order", () => {
    const items: PaletteSearchable[] = Array.from({ length: 50 }, (_, index) => ({
      label: `บริษัท ทดสอบ ${index}`,
      group: "item",
    }));

    const result = filterPaletteCommands(items, "ทดสอบ", 20);

    expect(result).toHaveLength(20);
    expect(result).toEqual(items.slice(0, 20));
  });
});
