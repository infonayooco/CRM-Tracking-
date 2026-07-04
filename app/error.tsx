"use client"; // Error boundaries must be Client Components

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

// Catches render errors in the app UI (page + nested content). The root layout
// stays mounted, so Tailwind/global styles are available here.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[task-list-ja]", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-lg font-bold text-slate-900">เกิดข้อผิดพลาด</h1>
        <p className="mt-2 text-sm text-slate-500">
          ระบบทำงานผิดพลาดชั่วคราว ข้อมูลของคุณยังอยู่ในเบราว์เซอร์ ลองใหม่อีกครั้งได้เลย
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:ring-offset-2"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          ลองใหม่
        </button>
      </div>
    </div>
  );
}
