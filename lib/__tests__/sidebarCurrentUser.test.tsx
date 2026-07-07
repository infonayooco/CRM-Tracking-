import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/Sidebar";
import { defaultFilters, useStore } from "@/lib/store";

function seedStore() {
  useStore.setState({
    customers: [],
    items: [],
    members: ["พี่ไซน์", "พี่บอส"],
    settings: { currentUser: "พี่ไซน์" },
    filters: defaultFilters,
  });
}

// Feature: the current user comes from the login session — the manual picker in
// the Sidebar only appears in standalone (no-Supabase) mode.
describe("Sidebar — current user source", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    useStore.setState({
      customers: [],
      items: [],
      members: [],
      settings: { currentUser: "" },
      filters: defaultFilters,
    });
  });

  it("standalone mode (no Supabase): shows the current-user dropdown", () => {
    seedStore();
    render(<Sidebar mobileOpen={false} onClose={() => {}} />);
    expect(screen.getByRole("combobox", { name: "ผู้ใช้ปัจจุบัน" })).toBeTruthy();
  });

  it("Supabase mode: shows the logged-in user read-only, with no dropdown", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    seedStore();
    render(<Sidebar mobileOpen={false} onClose={() => {}} />);
    expect(screen.queryByRole("combobox", { name: "ผู้ใช้ปัจจุบัน" })).toBeNull();
    expect(screen.getByText("พี่ไซน์")).toBeTruthy();
  });
});
