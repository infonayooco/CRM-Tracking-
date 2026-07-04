"use client";

import { useEffect, useState } from "react";
import { Database, Menu } from "lucide-react";
import { HydrationGate } from "@/components/HydrationGate";
import { ActiveFilterBar } from "@/components/ActiveFilterBar";
import { HomeView } from "@/components/HomeView";
import { ItemsView } from "@/components/ItemsView";
import { ItemModal } from "@/components/ItemModal";
import { CustomersView } from "@/components/CustomersView";
import { CalendarView } from "@/components/CalendarView";
import { GanttView } from "@/components/GanttView";
import { CommandPalette } from "@/components/CommandPalette";
import { Sidebar, useAttentionDueCount } from "@/components/Sidebar";
import { ReportView } from "@/components/ReportView";
import { CustomerReport } from "@/components/CustomerReport";
import { UndoToast } from "@/components/UndoToast";
import { StorageAlert } from "@/components/StorageAlert";
import { AuthBar } from "@/components/auth/AuthBar";
import { SyncAlert } from "@/components/SyncAlert";
import { useStore, type AppViewKey } from "@/lib/store";
import type { SessionProfile } from "@/lib/auth/session";

export function AppRoot({
  supabaseMode = false,
  profile,
}: {
  supabaseMode?: boolean;
  profile?: SessionProfile | null;
}) {
  // Back the existing "งานของฉัน"/currentUser mechanism with the signed-in
  // identity so it doesn't reset to "" on every load in Supabase mode.
  const currentUser =
    supabaseMode && profile ? profile.salesOwner || profile.displayName || "" : null;
  useEffect(() => {
    if (currentUser !== null) useStore.getState().setCurrentUser(currentUser);
  }, [currentUser]);

  return (
    <HydrationGate supabaseMode={supabaseMode}>
      {supabaseMode && profile ? (
        <AuthBar displayName={profile.displayName} role={profile.role} />
      ) : null}
      {supabaseMode ? <SyncAlert /> : null}
      <AppShell />
    </HydrationGate>
  );
}

function AppShell() {
  const view = useStore((state) => state.view);
  const reportCustomerId = useStore((state) => state.reportCustomerId);
  const isPaletteOpen = useStore((state) => state.isPaletteOpen);
  const openPalette = useStore((state) => state.openPalette);
  const closePalette = useStore((state) => state.closePalette);
  const openItemModal = useStore((state) => state.openItemModal);
  const isItemModalOpen = useStore((state) => state.isItemModalOpen);
  const closeItemModal = useStore((state) => state.closeItemModal);
  const showActiveFilterBar =
    view === "items" || view === "calendar" || view === "report" || view === "timeline";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPaletteCombo =
        (event.metaKey || event.ctrlKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLocaleLowerCase() === "k";

      if (isPaletteCombo) {
        event.preventDefault();
        if (isPaletteOpen) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      if (isTypingTarget(event.target)) return;

      if (event.key === "Escape") {
        if (isPaletteOpen) {
          event.preventDefault();
          closePalette();
          return;
        }

        if (isItemModalOpen) {
          event.preventDefault();
          closeItemModal();
        }
        return;
      }

      if (isPaletteOpen) return;

      const hasModifier = event.metaKey || event.ctrlKey || event.altKey || event.shiftKey;
      if (!hasModifier && event.key.toLocaleLowerCase() === "n") {
        openItemModal();
        return;
      }

      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key === "/") {
        event.preventDefault();
        openPalette();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    closeItemModal,
    closePalette,
    isItemModalOpen,
    isPaletteOpen,
    openItemModal,
    openPalette,
  ]);

  return (
    <>
      <div className="app-shell min-h-screen bg-slate-100 md:flex">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar onOpenNav={() => setMobileNavOpen(true)} />
          <main className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 p-4 sm:p-6 lg:p-8">
            {showActiveFilterBar ? <ActiveFilterBar /> : null}
            {renderPlaceholder(view)}
          </main>
        </div>
        <ItemModal />
      </div>
      <CommandPalette />
      <UndoToast />
      <StorageAlert />
      {reportCustomerId ? <CustomerReport /> : null}
    </>
  );
}

function MobileTopBar({ onOpenNav }: { onOpenNav: () => void }) {
  const attentionDue = useAttentionDueCount();

  return (
    <header
      id="mobileTopbar"
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-2.5 shadow-sm backdrop-blur md:hidden"
    >
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="เปิดเมนู"
        className="grid size-11 shrink-0 place-items-center rounded-lg border border-border text-ink transition-colors hover:bg-primary-light hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-100"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      {attentionDue > 0 ? (
        <span
          className="tnum shrink-0 rounded-full bg-error px-2 py-0.5 text-xs font-semibold text-white"
          aria-label={`${attentionDue} รายการที่ต้องดำเนินการวันนี้`}
        >
          {attentionDue.toLocaleString("th-TH")}
        </span>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
          <Database className="size-4" aria-hidden="true" />
        </span>
        <span className="truncate text-sm font-semibold text-ink">ระบบติดตามงานสื่อสารลูกค้า</span>
      </div>
    </header>
  );
}

function renderPlaceholder(view: AppViewKey) {
  switch (view) {
    case "home":
      return <HomeView />;
    case "items":
      return <ItemsView />;
    case "calendar":
      return <CalendarView />;
    case "timeline":
      return <GanttView />;
    case "customers":
      return <CustomersView />;
    case "report":
      return <ReportView />;
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName;
  return tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || target.isContentEditable;
}
