"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotResult } from "@/app/auth/actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-brand-100";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<ForgotResult, FormData>(
    requestPasswordReset,
    undefined,
  );
  const sent = Boolean(state && "sent" in state && state.sent);
  const error = state && "error" in state ? state.error : undefined;

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
    >
      <h1 className="text-xl font-bold text-ink">ลืมรหัสผ่าน</h1>
      <p className="mt-1 text-sm text-muted">กรอกอีเมลของบัญชี แล้วเราจะส่งลิงก์รีเซ็ตรหัสผ่านไปให้</p>

      {sent ? (
        <p
          role="status"
          className="mt-4 rounded-lg bg-success-light px-3 py-2 text-sm text-success-dark"
        >
          ถ้ามีบัญชีสำหรับอีเมลนี้ ระบบได้ส่งลิงก์รีเซ็ตรหัสผ่านไปให้แล้ว — กรุณาตรวจสอบกล่องอีเมล
          (รวมถึงโฟลเดอร์สแปม)
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded-lg bg-error-light px-3 py-2 text-sm text-error-dark">
          {error}
        </p>
      ) : null}

      {sent ? null : (
        <>
          <label className="mt-4 block text-sm font-medium text-ink">
            อีเมล
            <input name="email" type="email" required autoComplete="email" className={fieldClass} />
          </label>

          <button
            type="submit"
            disabled={pending}
            className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
          >
            {pending ? "กำลังส่ง…" : "ส่งลิงก์รีเซ็ตรหัสผ่าน"}
          </button>
        </>
      )}

      <p className="mt-4 text-center text-sm text-muted">
        <Link href="/login" className="font-medium text-primary hover:underline">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
