import { describe, expect, it } from "vitest";
import { normalizeItem } from "@/lib/normalize";
import { makeItem } from "./factory";

// activity[] is appended forever (never pruned at write time), which would
// grow the persisted localStorage blob without bound. normalizeItem caps it
// on every normalize (load/import/edit) to the most recent MAX_ACTIVITY (50)
// entries, since activity is appended chronologically.
describe("normalizeItem — activity[] cap (#MAX_ACTIVITY)", () => {
  it("caps 60 activity entries down to exactly the most recent 50", () => {
    const activity = Array.from({ length: 60 }, (_, index) => ({
      ts: `2020-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      text: `entry-${index}`,
    }));
    const item = makeItem({ activity });

    const normalized = normalizeItem(item, new Set(["c1"]));

    expect(normalized.activity).toHaveLength(50);
    // the LAST 50 entries are kept — i.e. entries 10..59 (the oldest 10, 0..9, are dropped)
    expect(normalized.activity[0].text).toBe("entry-10");
    expect(normalized.activity[normalized.activity.length - 1].text).toBe("entry-59");
  });

  it("leaves an item with fewer than 50 activity entries unchanged in length and content", () => {
    const activity = Array.from({ length: 12 }, (_, index) => ({
      ts: `2020-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      text: `entry-${index}`,
    }));
    const item = makeItem({ activity });

    const normalized = normalizeItem(item, new Set(["c1"]));

    expect(normalized.activity).toHaveLength(12);
    expect(normalized.activity.map((entry) => entry.text)).toEqual(activity.map((entry) => entry.text));
  });
});
