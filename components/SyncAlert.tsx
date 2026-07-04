"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { onSyncError } from "@/lib/data/sync";

// Shown when a write to Supabase fails, so a rejected/failed save isn't silent.
// The change stays in the local store and is retried on the next edit.
export function SyncAlert() {
  const [visible, setVisible] = useState(false);

  useEffect(() => onSyncError(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning-dark shadow-soft"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium">
          บันทึกขึ้นเซิร์ฟเวอร์ไม่สำเร็จ
          <span className="mt-0.5 block font-normal text-warning-dark/80">
            การแก้ไขล่าสุดยังไม่ถูกบันทึกไปยังฐานข้อมูล ระบบจะลองใหม่เมื่อคุณแก้ไขอีกครั้ง —
            หากยังไม่หาย กรุณารีเฟรชหน้าและตรวจสอบการเชื่อมต่อ
          </span>
        </p>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-warning-dark transition hover:bg-warning/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning/40"
          aria-label="ปิด"
          title="ปิด"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
