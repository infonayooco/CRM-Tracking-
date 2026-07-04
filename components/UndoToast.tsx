"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/lib/store";

export function UndoToast() {
  const lastDeleted = useStore((state) => state.lastDeleted);
  const lastDeletedCustomer = useStore((state) => state.lastDeletedCustomer);
  const undoDelete = useStore((state) => state.undoDelete);
  const undoDeleteCustomer = useStore((state) => state.undoDeleteCustomer);
  const dismissUndo = useStore((state) => state.dismissUndo);

  useEffect(() => {
    if (!lastDeleted && !lastDeletedCustomer) return;

    const timerId = window.setTimeout(() => {
      dismissUndo();
    }, 6000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [dismissUndo, lastDeleted, lastDeletedCustomer]);

  if (!lastDeleted && !lastDeletedCustomer) return null;

  const label = lastDeletedCustomer
    ? `ลบลูกค้า "${lastDeletedCustomer.customer.name}"${
        lastDeletedCustomer.items.length
          ? ` และ ${lastDeletedCustomer.items.length.toLocaleString("th-TH")} ชิ้นงาน`
          : ""
      } แล้ว`
    : "ลบชิ้นงานแล้ว";
  const onUndo = lastDeletedCustomer ? undoDeleteCustomer : undoDelete;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-soft"
      >
        <span className="min-w-0 flex-1 font-medium">{label}</span>
        <button
          type="button"
          onClick={onUndo}
          className="shrink-0 rounded-lg px-2 py-1 font-semibold text-brand-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
        >
          เลิกทำ
        </button>
        <button
          type="button"
          onClick={dismissUndo}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
          aria-label="ปิด"
          title="ปิด"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
