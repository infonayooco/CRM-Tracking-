import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Exchanges the ?code from an email-confirmation / magic link for a session,
// then redirects into the app (or back to /login on failure).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/";
  // Only allow same-origin relative paths — reject open-redirect payloads like
  // "//evil.com", "@evil.com", or absolute URLs with a scheme.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
