import { describe, expect, it } from "vitest";
import { itemTypePerformance } from "@/lib/derived";
import { parseTeamCsv } from "@/lib/parseTeamCsv";
import { SEED_CSV } from "@/lib/seedCsv";
import { makeItem } from "./factory";

describe("itemTypePerformance — seed", () => {
  const { items } = parseTeamCsv(SEED_CSV);
  const rows = itemTypePerformance(items);

  it("attributes every item to exactly one format row", () => {
    expect(rows.reduce((total, row) => total + row.count, 0)).toBe(items.length);
  });

  it("is sorted by count descending", () => {
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].count).toBeGreaterThanOrEqual(rows[i].count);
    }
  });
});

describe("itemTypePerformance — outcome math", () => {
  it("computes achieved% / report% per group; unrated items are excluded from ⭐", () => {
    const rows = itemTypePerformance([
      makeItem({ id: "a", itemType: "video", resultStatus: "achieved", reportStatus: "sent", rating: 4 }),
      makeItem({ id: "b", itemType: "video", resultStatus: "not_collected", reportStatus: "not_sent", rating: 0 }),
    ]);
    const video = rows.find((row) => row.itemType === "video");
    expect(video?.count).toBe(2);
    expect(video?.achievedPct).toBe(50);
    expect(video?.reportSentPct).toBe(50);
    expect(video?.avgRating).toBe(4); // only the rated item counts
    expect(video?.ratedCount).toBe(1);
  });

  it("groups a blank itemType under the fallback label", () => {
    const rows = itemTypePerformance([makeItem({ id: "x", itemType: "  " })]);
    expect(rows[0].itemType).toBe("(ไม่ระบุรายการ)");
  });
});
