import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import { getSessionProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) redirect("/");
  // Already signed in — no need to reset from a forgotten state.
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role ? "/" : "/pending");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <ForgotPasswordForm />
    </main>
  );
}
