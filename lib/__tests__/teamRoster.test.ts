import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { useStore } from "@/lib/store";

describe('addMember — "เพิ่มรายชื่อใหม่" appends to the shared central members list', () => {
  beforeEach(() => {
    useStore.setState({ members: [] });
  });
  afterEach(() => {
    useStore.setState({ members: [] });
  });

  it("trims and appends a new name", () => {
    useStore.getState().addMember("  พี่ก้อย  ");
    expect(useStore.getState().members).toEqual(["พี่ก้อย"]);
  });

  it("ignores an empty/whitespace-only name", () => {
    useStore.getState().addMember("   ");
    expect(useStore.getState().members).toEqual([]);
  });

  it("ignores an exact-match duplicate, matching the existing salesOwner auto-add dedupe", () => {
    useStore.setState({ members: ["พี่ก้อย"] });
    useStore.getState().addMember("พี่ก้อย");
    expect(useStore.getState().members).toEqual(["พี่ก้อย"]);
  });

  it("does not disturb members already auto-grown from salesOwner", () => {
    useStore.getState().upsertCustomer({ name: "ลูกค้าใหม่", salesOwner: "พี่แนน" });
    useStore.getState().addMember("พี่บอส");
    expect(useStore.getState().members).toEqual(["พี่แนน", "พี่บอส"]);
  });
});

describe("teamRoster — read-only registered-account list populated by hydration", () => {
  beforeEach(() => {
    useStore.setState({ teamRoster: [] });
    window.localStorage.clear();
  });
  afterEach(() => {
    useStore.setState({ teamRoster: [] });
    window.localStorage.clear();
  });

  it("defaults to [] (standalone/localStorage mode still works with no roster)", () => {
    expect(useStore.getState().teamRoster).toEqual([]);
  });

  it("setTeamRoster replaces the list (the hydration-path setter)", () => {
    useStore.getState().setTeamRoster(["พี่ก้อย", "พี่บอส"]);
    expect(useStore.getState().teamRoster).toEqual(["พี่ก้อย", "พี่บอส"]);
  });

  it("is never written to localStorage", () => {
    useStore.getState().setTeamRoster(["พี่ก้อย"]);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).not.toHaveProperty("teamRoster");
  });
});
