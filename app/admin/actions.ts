"use server";

import { revalidatePath } from "next/cache";
import { parseRole } from "@/lib/auth/permissions";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type RoleResult = { ok: true } | { error: string } | undefined;

export async function updateUserRole(_prev: RoleResult, formData: FormData): Promise<RoleResult> {
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "ไม่พบผู้ใช้" };

  // The RPC is admin-gated by is_admin() in SQL; re-check here as defense in depth
  // and to give a friendly message instead of a raw RLS error.
  const me = await getSessionProfile();
  if (me?.role !== "admin") return { error: "เฉพาะผู้ดูแลระบบเท่านั้น" };
  if (me.id === userId) return { error: "ไม่สามารถแก้สิทธิ์ของบัญชีตัวเองได้" };

  const newRole = parseRole(String(formData.get("role") ?? ""));
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_role", {
    target_user: userId,
    new_role: newRole,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
