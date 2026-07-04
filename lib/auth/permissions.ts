// Client-safe (no server imports): role labels + capability map used to gate UI.
// This MIRRORS the RLS policies in supabase/migrations — RLS is the real guard;
// this only hides/disables actions a role can't perform. Keep the two in sync.
import type { AppRole } from "@/lib/supabase/database.types";

export type { AppRole };

export const ALL_ROLES: readonly AppRole[] = ["admin", "manager", "sale", "cs", "mkt"] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้จัดการ",
  sale: "ฝ่ายขาย",
  cs: "ฝ่ายบริการลูกค้า",
  mkt: "การตลาด",
};

export type Capability =
  | "customers.create"
  | "customers.update"
  | "customers.delete"
  | "items.create"
  | "items.update"
  | "items.delete"
  | "team.manage"
  | "admin.users";

const CAPABILITIES: Record<AppRole, readonly Capability[]> = {
  admin: [
    "customers.create",
    "customers.update",
    "customers.delete",
    "items.create",
    "items.update",
    "items.delete",
    "team.manage",
    "admin.users",
  ],
  manager: [
    "customers.create",
    "customers.update",
    "customers.delete",
    "items.create",
    "items.update",
    "items.delete",
    "team.manage",
  ],
  sale: ["customers.create", "customers.update", "items.create", "items.update"],
  cs: ["customers.update", "items.update"],
  mkt: ["items.create", "items.update"],
};

export function can(role: AppRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  return CAPABILITIES[role].includes(capability);
}

// Parse an untrusted role string (e.g. from a form) into a valid AppRole, or
// null (revoke / pending). Single source of truth via ALL_ROLES.
export function parseRole(value: string): AppRole | null {
  return (ALL_ROLES as readonly string[]).includes(value) ? (value as AppRole) : null;
}
