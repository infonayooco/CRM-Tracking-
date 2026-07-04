import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY, STORE_VERSION } from "@/lib/constants";
import { useStore } from "@/lib/store";

describe("setOwnerQuota (#11) — per-owner revenue quota", () => {
  beforeEach(() => {
    useStore.setState({ ownerQuotas: {} });
  });

  afterEach(() => {
    useStore.setState({ ownerQuotas: {} });
  });

  it("sets a quota for an owner", () => {
    useStore.getState().setOwnerQuota("พี่ไซน์", 500000);
    expect(useStore.getState().ownerQuotas["พี่ไซน์"]).toBe(500000);
  });

  it("removes the key when set to 0", () => {
    useStore.getState().setOwnerQuota("พี่ไซน์", 500000);
    useStore.getState().setOwnerQuota("พี่ไซน์", 0);

    const quotas = useStore.getState().ownerQuotas;
    expect(quotas["พี่ไซน์"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(quotas, "พี่ไซน์")).toBe(false);
  });

  it("keeps quotas for two owners independently", () => {
    useStore.getState().setOwnerQuota("พี่ไซน์", 500000);
    useStore.getState().setOwnerQuota("พี่แนน", 300000);

    const quotas = useStore.getState().ownerQuotas;
    expect(quotas["พี่ไซน์"]).toBe(500000);
    expect(quotas["พี่แนน"]).toBe(300000);
  });

  it("treats a NaN amount as clear / no-op (key absent)", () => {
    useStore.getState().setOwnerQuota("พี่ไซน์", Number.NaN);

    const quotas = useStore.getState().ownerQuotas;
    expect(quotas["พี่ไซน์"]).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(quotas, "พี่ไซน์")).toBe(false);
  });
});

describe("ownerQuotas persistence (#11)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useStore.setState({ ownerQuotas: {} });
  });

  afterEach(() => {
    window.localStorage.clear();
    useStore.setState({ ownerQuotas: {} });
  });

  it("persists ownerQuotas into localStorage", () => {
    useStore.getState().setOwnerQuota("พี่ไซน์", 500000);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).ownerQuotas).toEqual({ พี่ไซน์: 500000 });
  });

  it("restores ownerQuotas from localStorage on rehydrate", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORE_VERSION,
        customers: [],
        items: [],
        members: [],
        settings: { currentUser: "" },
        ownerQuotas: { พี่ไซน์: 500000 },
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().ownerQuotas).toEqual({ พี่ไซน์: 500000 });
  });

  it("keeps ownerQuotas as {} when missing from an old persisted payload", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: STORE_VERSION,
        customers: [],
        items: [],
        members: [],
        settings: { currentUser: "" },
      }),
    );
    await useStore.persist.rehydrate();
    expect(useStore.getState().ownerQuotas).toEqual({});
  });
});
