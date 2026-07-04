"use client";

import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/database.types";

// Slim top bar shown when the app runs in Supabase mode: who you are + logout
// (and, for admins, a link to the user-management panel).
export function AuthBar({ displayName, role }: { displayName: string | null; role: AppRole | null }) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-border bg-surface px-4 py-1.5 text-xs text-muted">
      <span className="truncate">
        {displayName || "ผู้ใช้"}
        {role ? ` · ${ROLE_LABELS[role]}` : ""}
      </span>
      {role === "admin" ? (
        <Link
          href="/admin"
          className="rounded-md px-2 py-1 font-medium text-primary transition-colors hover:bg-primary-light"
        >
          จัดการผู้ใช้
        </Link>
      ) : null}
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-border px-2 py-1 font-medium text-ink transition-colors hover:bg-primary-light hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
