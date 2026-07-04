import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSessionProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role ? "/" : "/pending");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <LoginForm />
    </main>
  );
}
