"use client";

import { AlertTriangle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { onStorageError } from "@/lib/store";

// Persistent warning shown when a localStorage write fails (quota full / private
// mode). Unlike the transient UndoToast, this stays until dismissed because the
// user must act (Export JSON) or risk losing edits on the next reload.
export function StorageAlert() {
  const [visible, setVisible] = useState(false);

  useEffect(() => onStorageError(() => setVisible(true)), []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border border-warning/30 bg-warning-light px-4 py-3 text-sm text-warning-dark shadow-soft"
      >
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
        <p className="min-w-0 flex-1 font-medium">
          บันทึกข้อมูลลงเครื่องไม่สำเร็จ — พื้นที่จัดเก็บอาจเต็ม
          <span className="mt-0.5 block font-normal text-warning-dark/80">
            กรุณากด <span className="font-semibold">Export JSON</span> เพื่อสำรองข้อมูลทันที ก่อนรีเฟรชหน้า
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
