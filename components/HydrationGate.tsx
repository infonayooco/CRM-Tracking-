"use client";

import { useEffect, useState } from "react";
import { subscribeCrossTabSync, useStore } from "@/lib/store";

export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    let unsub = () => {};
    void (async () => {
      await useStore.persist.rehydrate();
      const state = useStore.getState();
      if (!state.initialized) {
        if (!state.items.length && !state.customers.length) state.seedFromCsv();
        // mark initialized so an emptied board is not reseeded next time
        useStore.setState({ initialized: true });
      }
      // keep this tab in sync when another tab of the same app writes our
      // storage key (see subscribeCrossTabSync for the echo-guard details)
      unsub = subscribeCrossTabSync();
      if (active) setReady(true);
    })();
    return () => {
      active = false;
      unsub();
    };
  }, []);

  if (!ready) {
    return <div className="grid min-h-screen place-items-center bg-slate-100 text-muted">กำลังโหลด…</div>;
  }

  return <>{children}</>;
}
