import { redirect } from "next/navigation";
import { AppRoot } from "@/components/AppRoot";
import { getSessionProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Server-side gate. When Supabase isn't configured, the app runs standalone
// (localStorage, no login) exactly as before — so shipping this can't break the
// live site. Once configured, it requires a signed-in user with an assigned role.
export default async function Page() {
  if (!isSupabaseConfigured()) {
    return <AppRoot supabaseMode={false} />;
  }

  const profile = await getSessionProfile();
  if (!profile) redirect("/login");
  if (!profile.role) redirect("/pending");

  return <AppRoot supabaseMode profile={profile} />;
}
