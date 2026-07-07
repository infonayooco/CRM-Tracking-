"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Return shape for useActionState-driven auth forms (built in the auth-UI phase).
export type AuthResult = { error: string } | undefined;

// Forgot-password request has a third state — a generic "sent" confirmation that
// never reveals whether an account exists for the email (anti-enumeration).
export type ForgotResult = { error: string } | { sent: true } | undefined;

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // Surface the "email not confirmed" case specifically — otherwise it looks
    // like a wrong password and is impossible to diagnose. (Other errors stay
    // generic to avoid account enumeration.)
    const notConfirmed = error.code === "email_not_confirmed" || /not confirmed/i.test(error.message);
    return {
      error: notConfirmed
        ? "บัญชีนี้ยังไม่ได้ยืนยันอีเมล — ติดต่อผู้ดูแลระบบเพื่อเปิดใช้งานบัญชี"
        : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email.split("@")[0] } },
  });
  // Generic message (don't reveal whether the email already has an account).
  if (error) return { error: "ไม่สามารถสมัครสมาชิกได้ กรุณาตรวจสอบอีเมลแล้วลองใหม่อีกครั้ง" };

  // New users land in "pending" until an admin grants them a role.
  revalidatePath("/", "layout");
  redirect("/pending");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  // Don't present a false "logged out": if the session wasn't cleared, surface
  // it rather than redirecting to /login with a still-valid cookie.
  if (error) throw error;
  revalidatePath("/", "layout");
  redirect("/login");
}

// Sends a password-reset email. The link routes through the shared code-exchange
// callback (which establishes a short-lived recovery session) and lands the user
// on /reset-password. We ALWAYS report success — never revealing whether the
// email has an account — to prevent account enumeration.
export async function requestPasswordReset(
  _prev: ForgotResult,
  formData: FormData,
): Promise<ForgotResult> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "กรุณากรอกอีเมล" };

  // Pin the reset-link origin to a server-controlled site URL. The request Host
  // header (X-Forwarded-Host) is client-spoofable, so trusting it here would let
  // an attacker poison the reset link and hijack the PKCE code (account takeover).
  // Fall back to the header ONLY outside production for local dev convenience.
  let origin = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "") ?? "";
  if (!origin && process.env.NODE_ENV !== "production") {
    const headerList = await headers();
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
    const proto = headerList.get("x-forwarded-proto") ?? "http";
    origin = host ? `${proto}://${host}` : "";
  }

  const supabase = await createClient();
  // With no trusted origin, omit redirectTo — Supabase falls back to the project
  // Site URL rather than a spoofed one. Log (never surface) errors so a broken
  // SMTP/redirect-allow-list config is detectable instead of silently failing.
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    origin ? { redirectTo: `${origin}/auth/callback?next=/reset-password` } : undefined,
  );
  if (error) console.error("[auth] resetPasswordForEmail failed:", error.message);

  return { sent: true };
}

// Sets a new password for the user in the recovery session created by the reset
// link (via /auth/callback). Requires a live session — an expired/invalid link
// has none, so we fail clearly instead of silently doing nothing.
export async function updatePassword(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8) return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  if (password !== confirm) return { error: "รหัสผ่านทั้งสองช่องไม่ตรงกัน" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "ลิงก์รีเซ็ตหมดอายุหรือไม่ถูกต้อง — กรุณาขอลิงก์ใหม่อีกครั้ง" };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "ตั้งรหัสผ่านใหม่ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };

  revalidatePath("/", "layout");
  redirect("/");
}
