import { redirect } from "next/navigation";
import { signOut } from "@/app/auth/actions";
import { getSessionProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Landing for a signed-in user who has no role yet (pending admin approval).
export default async function PendingPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (profile.role) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-ink">บัญชีรอการอนุมัติ</h1>
        <p className="mt-3 text-sm text-muted">
          บัญชี <span className="font-medium text-ink">{profile.email}</span> ถูกสร้างเรียบร้อยแล้ว
          แต่ยังไม่ได้รับสิทธิ์การใช้งาน กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดบทบาท (role) ให้บัญชีของคุณ
          แล้วเข้าสู่ระบบอีกครั้ง
        </p>
        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary-light hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            ออกจากระบบ
          </button>
        </form>
      </div>
    </main>
  );
}
