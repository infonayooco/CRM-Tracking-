import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Establishes a session from an email link, then redirects into the app (or back
// to /login on failure). Handles BOTH link formats Supabase can send:
//   • ?code=...                 PKCE (OAuth / magic link / email confirmations)
//   • ?token_hash=...&type=...  email OTP — the format PASSWORD-RESET emails use.
//     It needs no PKCE code_verifier cookie, so it also works when the link is
//     opened on a different device/browser than the one that requested it.
// Previously only ?code was handled, so a recovery link (token_hash) fell through
// to /login instead of reaching /reset-password.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  // Only allow same-origin relative paths — reject open-redirect payloads like
  // "//evil.com", "@evil.com", or absolute URLs with a scheme.
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
