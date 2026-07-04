"use client";

import { useActionState } from "react";
import { updateUserRole, type RoleResult } from "@/app/admin/actions";
import { ALL_ROLES, ROLE_LABELS } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/supabase/database.types";

export function RoleForm({
  userId,
  currentRole,
  userLabel,
  disabled = false,
}: {
  userId: string;
  currentRole: AppRole | null;
  userLabel: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState<RoleResult, FormData>(updateUserRole, undefined);
  const isError = state !== undefined && "error" in state;

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <select
        // Uncontrolled: keeps the picked (saved) value on success. On error the
        // key flips, remounting the select so defaultValue re-applies and the
        // dropdown reverts to the true persisted role instead of the failed pick.
        key={isError ? "reverted" : "editing"}
        name="role"
        defaultValue={currentRole ?? ""}
        disabled={disabled || pending}
        aria-label={`กำหนดสิทธิ์ของ ${userLabel}`}
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option value="">— รออนุมัติ (ไม่มีสิทธิ์) —</option>
        {ALL_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "…" : "บันทึก"}
      </button>
      {state && "error" in state ? (
        <span role="alert" className="text-xs text-error">
          {state.error}
        </span>
      ) : null}
      {state && "ok" in state ? <span className="text-xs text-success">บันทึกแล้ว</span> : null}
    </form>
  );
}
