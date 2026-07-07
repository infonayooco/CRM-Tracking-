import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// The reset link lands here AFTER /auth/callback has exchanged the recovery code
// for a session, so we deliberately do NOT redirect signed-in users away — the
// user must have that (recovery) session to set a new password.
export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) redirect("/");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <ResetPasswordForm />
    </main>
  );
}
