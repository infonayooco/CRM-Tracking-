import { describe, expect, it } from "vitest";
import { campaignFunnel } from "@/lib/derived";
import { makeItem } from "./factory";

describe("campaignFunnel — base", () => {
  it("counts only published/done items into the base; a not_started item is excluded", () => {
    const funnel = campaignFunnel([
      makeItem({ id: "a", execStatus: "done" }),
      makeItem({ id: "b", execStatus: "published" }),
      makeItem({ id: "c", execStatus: "not_started" }),
    ]);
    expect(funnel.base).toBe(2);
  });
});

describe("campaignFunnel — stage percentages", () => {
  it("computes each stage as % of the published base (overlapping, not chained)", () => {
    const funnel = campaignFunnel([
      // collected + achieved + reported
      makeItem({ id: "a", execStatus: "done", resultStatus: "achieved", reportStatus: "sent" }),
      // collected + achieved, report still pending
      makeItem({ id: "b", execStatus: "done", resultStatus: "achieved", reportStatus: "not_sent" }),
      // collected (in_progress result), but not achieved
      makeItem({ id: "c", execStatus: "published", resultStatus: "in_progress", reportStatus: "not_sent" }),
      // not collected at all
      makeItem({ id: "d", execStatus: "published", resultStatus: "not_collected", reportStatus: "not_sent" }),
    ]);

    expect(funnel.base).toBe(4);

    const byKey = Object.fromEntries(funnel.stages.map((stage) => [stage.key, stage]));
    expect(byKey.published.count).toBe(4);
    expect(byKey.published.pct).toBe(100);
    expect(byKey.collected.count).toBe(3); // a, b, c — anything != not_collected
    expect(byKey.collected.pct).toBe(75);
    expect(byKey.achieved.count).toBe(2); // a, b
    expect(byKey.achieved.pct).toBe(50);
    expect(byKey.reported.count).toBe(1); // a
    expect(byKey.reported.pct).toBe(25);
  });
});

describe("campaignFunnel — empty base", () => {
  it("returns null pct for every stage when there is no published work", () => {
    const funnel = campaignFunnel([
      makeItem({ id: "a", execStatus: "not_started" }),
      makeItem({ id: "b", execStatus: "in_progress" }),
    ]);

    expect(funnel.base).toBe(0);
    funnel.stages.forEach((stage) => {
      expect(stage.pct).toBeNull();
    });
  });
});
