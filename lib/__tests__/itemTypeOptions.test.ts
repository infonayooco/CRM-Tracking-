import { describe, expect, it } from "vitest";
import { rankedItemTypeOptions } from "@/lib/itemTypeOptions";
import { makeItem } from "./factory";

describe("rankedItemTypeOptions", () => {
  it("sorts distinct itemTypes by frequency, most-used first", () => {
    const items = [
      makeItem({ id: "1", itemType: "Video" }),
      makeItem({ id: "2", itemType: "Video" }),
      makeItem({ id: "3", itemType: "Article" }),
    ];
    expect(rankedItemTypeOptions(items)).toEqual(["Video", "Article"]);
  });

  it("ignores blank itemType values", () => {
    const items = [makeItem({ id: "1", itemType: "  " }), makeItem({ id: "2", itemType: "SEO" })];
    expect(rankedItemTypeOptions(items)).toEqual(["SEO"]);
  });

  it("dedupes repeated values into a single distinct option", () => {
    const items = [
      makeItem({ id: "1", itemType: "SEO" }),
      makeItem({ id: "2", itemType: "SEO" }),
      makeItem({ id: "3", itemType: "SEO" }),
    ];
    expect(rankedItemTypeOptions(items)).toEqual(["SEO"]);
  });

  it("breaks frequency ties alphabetically", () => {
    const items = [makeItem({ id: "1", itemType: "Video" }), makeItem({ id: "2", itemType: "Article" })];
    expect(rankedItemTypeOptions(items)).toEqual(["Article", "Video"]);
  });

  it("lists channel-matching itemTypes first even when they're used less overall", () => {
    const items = [
      makeItem({ id: "1", itemType: "Global Favorite", channel: "web" }),
      makeItem({ id: "2", itemType: "Global Favorite", channel: "line" }),
      makeItem({ id: "3", itemType: "Global Favorite", channel: "google" }),
      makeItem({ id: "4", itemType: "Global Favorite", channel: "youtube" }),
      makeItem({ id: "5", itemType: "Global Favorite", channel: "other" }),
      makeItem({ id: "6", itemType: "Facebook Special", channel: "facebook" }),
    ];
    // Without channel bias, "Global Favorite" (5) would outrank "Facebook Special" (1).
    expect(rankedItemTypeOptions(items)).toEqual(["Global Favorite", "Facebook Special"]);
    expect(rankedItemTypeOptions(items, "facebook")).toEqual(["Facebook Special", "Global Favorite"]);
  });
});
