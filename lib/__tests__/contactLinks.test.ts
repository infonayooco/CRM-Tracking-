import { describe, expect, it } from "vitest";
import { lineHref, mailtoHref, telHref } from "@/lib/derived";

describe("telHref — click-to-call deep link", () => {
  it("strips formatting to digits/+ and prefixes tel:", () => {
    expect(telHref("081-234-5678")).toBe("tel:0812345678");
    expect(telHref("+66 81 234 5678")).toBe("tel:+66812345678");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("   ")).toBeNull();
  });
});

describe("mailtoHref — click-to-email deep link", () => {
  it("trims and prefixes mailto:", () => {
    expect(mailtoHref("  sales@example.com  ")).toBe("mailto:sales@example.com");
  });

  it("returns null for empty input", () => {
    expect(mailtoHref("")).toBeNull();
  });
});

describe("lineHref — best-effort LINE deep link", () => {
  it("builds the LINE add-by-ID URL, keeping a leading @", () => {
    expect(lineHref("@shop")).toBe("https://line.me/R/ti/p/~%40shop");
  });

  it("builds the URL for an id with no leading @", () => {
    expect(lineHref("shop123")).toBe("https://line.me/R/ti/p/~shop123");
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(lineHref("")).toBeNull();
    expect(lineHref("   ")).toBeNull();
  });
});
