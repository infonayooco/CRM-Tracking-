"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type AuthResult } from "@/app/auth/actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-brand-100";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signIn, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
    >
      <h1 className="text-xl font-bold text-ink">เข้าสู่ระบบ</h1>
      <p className="mt-1 text-sm text-muted">ระบบติดตามงานสื่อสารลูกค้า</p>

      {state?.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-error-light px-3 py-2 text-sm text-error-dark">
          {state.error}
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-medium text-ink">
        อีเมล
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        รหัสผ่าน
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      >
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          สมัครสมาชิก
        </Link>
      </p>
    </form>
  );
}
