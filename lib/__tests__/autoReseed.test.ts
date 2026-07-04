import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEY } from "@/lib/constants";
import { useStore } from "@/lib/store";

describe("initialized flag stops auto-reseed over an emptied board (#12)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useStore.setState({ items: [], customers: [], members: [], initialized: false });
  });

  it("restores initialized:true and keeps an emptied board empty on rehydrate", async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        customers: [],
        items: [],
        members: [],
        settings: { currentUser: "" },
        initialized: true,
      }),
    );

    await useStore.persist.rehydrate();

    // the true-first-run guard in HydrationGate only seeds when !initialized,
    // so a persisted initialized:true must survive rehydrate untouched.
    expect(useStore.getState().initialized).toBe(true);
    expect(useStore.getState().items.length).toBe(0);
    expect(useStore.getState().customers.length).toBe(0);
  });

  it("defaults initialized to falsy when nothing is persisted (true first run)", async () => {
    // no localStorage payload written — mirrors a brand-new install
    await useStore.persist.rehydrate();

    expect(useStore.getState().initialized).toBeFalsy();
  });
});
