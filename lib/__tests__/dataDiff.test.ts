import { describe, expect, it } from "vitest";
import { diffById, diffNumberRecord, diffStringSet } from "@/lib/data/diff";

describe("diffById", () => {
  it("flags inserts and changed rows as upserts, keeps unchanged rows out", () => {
    const prev = [
      { id: "a", v: 1 },
      { id: "b", v: 2 },
    ];
    const next = [
      { id: "a", v: 1 }, // unchanged
      { id: "b", v: 99 }, // changed
      { id: "c", v: 3 }, // new
    ];
    const diff = diffById(prev, next);
    expect(diff.upserts.map((r) => r.id).sort()).toEqual(["b", "c"]);
    expect(diff.deletes).toEqual([]);
  });

  it("flags removed ids as deletes", () => {
    const diff = diffById([{ id: "a" }, { id: "b" }], [{ id: "a" }]);
    expect(diff.upserts).toEqual([]);
    expect(diff.deletes).toEqual(["b"]);
  });

  it("is a no-op when nothing changed", () => {
    const diff = diffById([{ id: "a", v: 1 }], [{ id: "a", v: 1 }]);
    expect(diff.upserts).toEqual([]);
    expect(diff.deletes).toEqual([]);
  });
});

describe("diffStringSet", () => {
  it("reports added and removed names", () => {
    expect(diffStringSet(["a", "b"], ["b", "c"])).toEqual({ added: ["c"], removed: ["a"] });
  });
});

describe("diffNumberRecord", () => {
  it("reports changed/new entries and removed keys", () => {
    expect(diffNumberRecord({ a: 1, b: 2 }, { a: 1, b: 5, c: 3 })).toEqual({
      set: [["b", 5], ["c", 3]],
      removed: [],
    });
    expect(diffNumberRecord({ a: 1, b: 2 }, { a: 1 })).toEqual({ set: [], removed: ["b"] });
  });
});
