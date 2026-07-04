// Single source of truth for "is Supabase wired up?". When false, the app runs
// in standalone localStorage mode (no login wall) — so deploying the auth code
// before the env vars are set can't break the live site. Set both
// NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (then
// redeploy) to switch the app onto Supabase + login.
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
