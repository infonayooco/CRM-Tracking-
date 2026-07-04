"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthResult } from "@/app/auth/actions";

const fieldClass =
  "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-brand-100";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState<AuthResult, FormData>(signUp, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 shadow-sm"
    >
      <h1 className="text-xl font-bold text-ink">สมัครสมาชิก</h1>
      <p className="mt-1 text-sm text-muted">
        สมัครแล้วต้องรอผู้ดูแลระบบกำหนดสิทธิ์ (role) จึงจะเข้าใช้งานได้
      </p>

      {state?.error ? (
        <p role="alert" className="mt-4 rounded-lg bg-error-light px-3 py-2 text-sm text-error-dark">
          {state.error}
        </p>
      ) : null}

      <label className="mt-4 block text-sm font-medium text-ink">
        ชื่อที่แสดง
        <input name="displayName" type="text" autoComplete="name" className={fieldClass} />
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        อีเมล
        <input name="email" type="email" required autoComplete="email" className={fieldClass} />
      </label>

      <label className="mt-3 block text-sm font-medium text-ink">
        รหัสผ่าน
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

      <button
        type="submit"
        disabled={pending}
        className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:opacity-60"
      >
        {pending ? "กำลังสมัคร…" : "สมัครสมาชิก"}
      </button>

      <p className="mt-4 text-center text-sm text-muted">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          เข้าสู่ระบบ
        </Link>
      </p>
    </form>
  );
}
