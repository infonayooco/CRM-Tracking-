"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Return shape for useActionState-driven auth forms (built in the auth-UI phase).
export type AuthResult = { error: string } | undefined;

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "กรุณากรอกอีเมลและรหัสผ่าน" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" };

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
