"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { subscribeCrossTabSync, useStore } from "@/lib/store";

// Loads the store before rendering the app. In Supabase mode the store is
// hydrated from the DB and kept in sync; otherwise it uses the original
// localStorage backing (seeded from CSV on first run).
export function HydrationGate({
  children,
  supabaseMode = false,
}: {
  children: ReactNode;
  supabaseMode?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unsub = () => {};

    void (async () => {
      try {
        if (supabaseMode) {
          // Import lazily so the Supabase client isn't pulled into the
          // standalone bundle.
          const { hydrateFromSupabase, startSupabaseSync } = await import("@/lib/data/sync");
          await hydrateFromSupabase();
          // Bail if the effect was cleaned up mid-hydrate, so we never leave a
          // realtime channel + store subscription running without teardown.
          if (!active) return;
          unsub = startSupabaseSync();
        } else {
          await useStore.persist.rehydrate();
          const state = useStore.getState();
          if (!state.initialized) {
            if (!state.items.length && !state.customers.length) state.seedFromCsv();
            useStore.setState({ initialized: true });
          }
          unsub = subscribeCrossTabSync();
        }
        if (active) setReady(true);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      }
    })();

    return () => {
      active = false;
      unsub();
    };
  }, [supabaseMode]);

  if (error) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6 text-center">
        <div className="max-w-md">
          <p className="text-lg font-semibold text-ink">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="mt-2 break-words text-sm text-muted">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-100"
          >
            ลองใหม่
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-muted">กำลังโหลด…</div>;
  }

  return <>{children}</>;
}
