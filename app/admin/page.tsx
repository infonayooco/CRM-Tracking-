import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleForm } from "@/components/admin/RoleForm";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Admin-only: list users and assign/revoke roles via the admin_set_role RPC.
export default async function AdminPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const me = await getSessionProfile();
  if (!me) redirect("/login");
  if (!me.role) redirect("/pending");
  if (me.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, role")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (
    <main className="mx-auto w-full max-w-3xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-ink">จัดการผู้ใช้และสิทธิ์</h1>
        <Link href="/" className="shrink-0 text-sm font-medium text-primary hover:underline">
          ← กลับหน้าหลัก
        </Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-sm">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">ผู้ใช้</th>
              <th className="px-4 py-3 font-medium">สิทธิ์ปัจจุบัน</th>
              <th className="px-4 py-3 font-medium">กำหนดสิทธิ์</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user) => (
              <tr key={user.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 align-top">
                  <div className="font-medium text-ink">{user.display_name || "—"}</div>
                  <div className="text-xs text-muted">{user.email}</div>
                </td>
                <td className="px-4 py-3 align-top">
                  {user.role ? (
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {ROLE_LABELS[user.role]}
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      รออนุมัติ
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <RoleForm
                    userId={user.id}
                    currentRole={user.role}
                    userLabel={user.display_name || user.email || user.id}
                    disabled={user.id === me.id}
                  />
                </td>
              </tr>
            ))}
            {(users ?? []).length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-muted">
                  ยังไม่มีผู้ใช้
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        * แก้สิทธิ์ของบัญชีตัวเองไม่ได้ (กันการถอนสิทธิ์แอดมินโดยไม่ตั้งใจ)
      </p>
    </main>
  );
}
