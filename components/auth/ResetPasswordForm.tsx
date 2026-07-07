"use client";

import { useActionState } from "react";
import { updatePassword, type AuthResult } from "@/app/auth/actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-brand-100";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(updatePassword, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
    >
      <h1 className="text-xl font-bold text-ink">ตั้งรหัสผ่านใหม่</h1>
      <p className="mt-1 text-sm text-muted">กรอกรหัสผ่านใหม่ที่ต้องการใช้เข้าสู่ระบบ</p>

      {state?.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-error-light px-3 py-2 text-sm text-error-dark">
          {state.error}
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-medium text-ink">
        รหัสผ่านใหม่
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClass}
        />
        <span className="mt-1 block text-xs text-muted">อย่างน้อย 8 ตัวอักษร</span>
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        ยืนยันรหัสผ่านใหม่
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      >
        {pending ? "กำลังบันทึก…" : "บันทึกรหัสผ่านใหม่"}
      </button>
    </form>
  );
}
