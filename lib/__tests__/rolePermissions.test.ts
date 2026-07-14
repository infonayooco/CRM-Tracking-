import { describe, expect, it } from "vitest";
import { ALL_ROLES, can, parseRole } from "@/lib/auth/permissions";

// UI capability map must mirror the RLS policies in supabase/migrations.
describe("role permissions", () => {
  it("admin can do everything including user management", () => {
    for (const cap of [
      "customers.create",
      "customers.delete",
      "items.create",
      "items.delete",
      "admin.users",
    ] as const) {
      expect(can("admin", cap)).toBe(true);
    }
  });

  it("only admin manages users", () => {
    expect(can("manager", "admin.users")).toBe(false);
    expect(can("sale", "admin.users")).toBe(false);
    expect(can("cs", "admin.users")).toBe(false);
    expect(can("mkt", "admin.users")).toBe(false);
  });

  it("delete is limited to admin and manager", () => {
    expect(can("manager", "customers.delete")).toBe(true);
    expect(can("sale", "customers.delete")).toBe(false);
    expect(can("cs", "items.delete")).toBe(false);
    expect(can("mkt", "items.delete")).toBe(false);
  });

  it("cs can create and update customers/items but not delete", () => {
    expect(can("cs", "customers.create")).toBe(true);
    expect(can("cs", "customers.update")).toBe(true);
    expect(can("cs", "items.create")).toBe(true);
    expect(can("cs", "items.update")).toBe(true);
    expect(can("cs", "customers.delete")).toBe(false);
    expect(can("cs", "items.delete")).toBe(false);
  });

  it("mkt works on items only, not customers", () => {
    expect(can("mkt", "items.create")).toBe(true);
    expect(can("mkt", "customers.create")).toBe(false);
    expect(can("mkt", "customers.update")).toBe(false);
  });

  it("team management (members/quotas) is admin/manager only", () => {
    expect(can("admin", "team.manage")).toBe(true);
    expect(can("manager", "team.manage")).toBe(true);
    expect(can("sale", "team.manage")).toBe(false);
    expect(can("cs", "team.manage")).toBe(false);
    expect(can("mkt", "team.manage")).toBe(false);
  });

  it("a pending (no-role) user can do nothing", () => {
    expect(can(null, "items.update")).toBe(false);
    expect(can(null, "customers.update")).toBe(false);
  });

  it("covers all five roles", () => {
    expect([...ALL_ROLES].sort()).toEqual(["admin", "cs", "manager", "mkt", "sale"]);
  });

  it("parseRole accepts valid roles and maps anything else to null (revoke)", () => {
    for (const role of ALL_ROLES) expect(parseRole(role)).toBe(role);
    expect(parseRole("")).toBeNull();
    expect(parseRole("superuser")).toBeNull();
    expect(parseRole("ADMIN")).toBeNull();
  });
});
