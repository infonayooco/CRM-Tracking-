import type { AppRole } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export type SessionProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: AppRole | null;
  salesOwner: string | null;
};

// Server-only: the current user's profile (incl. role), or null if signed out.
// role === null means the account is pending admin approval.
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, sales_owner")
    .eq("id", user.id)
    .maybeSingle();

  // Surface a real query failure (RLS/config/network) instead of silently
  // masking it as a "pending" user with no role.
  if (error) throw error;

  if (!data) {
    // Authenticated but no profile row yet (e.g. trigger lag) — treat as pending.
    return { id: user.id, email: user.email ?? null, displayName: null, role: null, salesOwner: null };
  }

  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    role: data.role,
    salesOwner: data.sales_owner,
  };
}
