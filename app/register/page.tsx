import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getSessionProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function RegisterPage() {
  if (!isSupabaseConfigured()) redirect("/");
  const profile = await getSessionProfile();
  if (profile) redirect(profile.role ? "/" : "/pending");

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <RegisterForm />
    </main>
  );
}
