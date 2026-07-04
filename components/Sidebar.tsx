"use client";

import { useMemo, useRef, type ChangeEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  Database,
  FileDown,
  FileText,
  FileUp,
  GanttChartSquare,
  RefreshCw,
  UserRound,
  Users,
  X,
} from "lucide-react";
import {
  attentionDueCount,
  itemsExpired,
  itemsExpiringSoon,
  itemsNotPublished,
  itemsReportNotSent,
  itemsResultsNotCollected,
} from "@/lib/derived";
import { downloadFile } from "@/lib/exportData";
import { parseTeamCsv } from "@/lib/parseTeamCsv";
import { useStore, type AppViewKey } from "@/lib/store";
import type { Store } from "@/lib/types";
import { Button, inputClass } from "@/components/ui";

const navItems: { view: AppViewKey; label: string; icon: typeof ClipboardList }[] = [
  { view: "home", label: "สิ่งที่ต้องทำ", icon: CircleAlert },
  { view: "items", label: "ชิ้นงาน", icon: ClipboardList },
  { view: "calendar", label: "Calendar", icon: CalendarDays },
  { view: "timeline", label: "ไทม์ไลน์", icon: GanttChartSquare },
  { view: "customers", label: "ลูกค้า", icon: Users },
  { view: "report", label: "รายงาน", icon: BarChart3 },
];

// Shared by the sidebar nav badge and the mobile top bar — one source of truth
// for "how many things need attention TODAY" (follow-ups due/overdue + overdue
// publish/deadline work), scoped to the "mine" filter exactly like HomeView.
export function useAttentionDueCount(): number {
  const items = useStore((state) => state.items);
  const customers = useStore((state) => state.customers);
  const mine = useStore((state) => state.filters.mine);
  const currentUser = useStore((state) => state.settings.currentUser);

  return useMemo(() => {
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const scoped = mine
      ? items.filter((item) => customerById.get(item.customerId)?.salesOwner === currentUser)
      : items;
    return attentionDueCount(scoped, new Date());
  }, [items, customers, mine, currentUser]);
}

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const view = useStore((state) => state.view);
  const setView = useStore((state) => state.setView);
  const items = useStore((state) => state.items);
  const customers = useStore((state) => state.customers);
  const members = useStore((state) => state.members);
  const currentUser = useStore((state) => state.settings.currentUser);
  const mine = useStore((state) => state.filters.mine);
  const itemCount = items.length;
  const seedFromCsv = useStore((state) => state.seedFromCsv);
  const importFromCsv = useStore((state) => state.importFromCsv);
  const importFromJson = useStore((state) => state.importFromJson);
  const exportCsv = useStore((state) => state.exportCsv);
  const exportJson = useStore((state) => state.exportJson);
  const setCurrentUser = useStore((state) => state.setCurrentUser);
  const setFilter = useStore((state) => state.setFilter);
  const currentInitial = currentUser.trim().slice(0, 1);
  // "Needs attention today" reminder — follow-ups due/overdue + overdue
  // publish/deadline work, visible from any view via the Home nav badge.
  const attentionDue = useAttentionDueCount();
  // Mirror HomeView exactly: same "mine" scope + same 5 worklists, so the nav
  // badge always agrees with the number shown on สิ่งที่ต้องทำ.
  const attentionCount = useMemo(() => {
    const today = new Date();
    const customerById = new Map(customers.map((customer) => [customer.id, customer]));
    const scoped = mine
      ? items.filter((item) => customerById.get(item.customerId)?.salesOwner === currentUser)
      : items;
    return (
      itemsNotPublished(scoped, today).length +
      itemsResultsNotCollected(scoped).length +
      itemsReportNotSent(scoped).length +
      itemsExpiringSoon(scoped, today).length +
      itemsExpired(scoped, today).length
    );
  }, [items, customers, mine, currentUser]);

  const handleSeed = () => {
    if (
      itemCount > 0 &&
      !window.confirm("ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจริงของทีม ต้องการดำเนินการต่อหรือไม่?")
    ) {
      return;
    }

    seedFromCsv();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const isCsv = /\.csv$/i.test(file.name);
      const isJson = /\.json$/i.test(file.name);

      if (!isCsv && !isJson) {
        throw new Error("รองรับเฉพาะไฟล์ CSV หรือ JSON");
      }

      if (isCsv) {
        const parsed = parseTeamCsv(text);
        if (!window.confirm(importConfirmText(parsed.customers.length, parsed.items.length))) return;
        importFromCsv(text);
        return;
      }

      const parsed = JSON.parse(text) as unknown;
      const preview = getJsonPreview(parsed);
      if (!window.confirm(importConfirmText(preview.customers, preview.items))) return;
      importFromJson(parsed);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "นำเข้าไฟล์ไม่สำเร็จ");
    } finally {
      input.value = "";
    }
  };

  const handleExportCsv = () => {
    downloadFile("customer-communication-tracking.csv", exportCsv(), "text/csv;charset=utf-8");
  };

  const handleExportJson = () => {
    downloadFile("customer-communication-backup.json", exportJson(), "application/json;charset=utf-8");
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity duration-200 md:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] transform flex-col overflow-y-auto border-r border-border bg-surface text-ink transition-transform duration-200 md:static md:z-auto md:min-h-screen md:max-w-none md:translate-x-0 md:transition-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-600 text-white">
              <Database className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold leading-6 text-ink">ระบบติดตามงานสื่อสารลูกค้า</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดเมนู"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-primary-light hover:text-primary focus:outline-none focus:ring-2 focus:ring-brand-100 md:hidden"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

      <nav className="flex flex-col px-3 py-4" aria-label="มุมมองหลัก">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = view === item.view;

          return (
            <button
              key={item.view}
              type="button"
              onClick={() => {
                setView(item.view);
                onClose();
              }}
              aria-current={active ? "page" : undefined}
              className={`mb-0.5 flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm font-semibold transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-muted hover:bg-primary-light hover:text-primary"
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.view === "home" ? (
                <span className="flex shrink-0 items-center gap-1.5">
                  {attentionDue > 0 ? (
                    <span
                      className="tnum rounded-full bg-error px-2 py-0.5 text-xs font-semibold text-white"
                      aria-label={`${attentionDue} รายการที่ต้องดำเนินการวันนี้`}
                    >
                      {attentionDue.toLocaleString("th-TH")}
                    </span>
                  ) : null}
                  <span
                    className={`tnum rounded-full px-2 py-0.5 text-xs font-semibold ${
                      active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {attentionCount.toLocaleString("th-TH")}
                  </span>
                </span>
              ) : item.view === "items" ? (
                <span
                  className={`tnum rounded-full px-2 py-0.5 text-xs font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {itemCount.toLocaleString("th-TH")}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="mt-6 px-1 pb-2 text-xs font-bold uppercase tracking-wide text-muted">
          ผู้ใช้ปัจจุบัน
        </p>
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-light text-sm font-semibold text-primary-dark ring-1 ring-inset ring-border">
            {currentInitial || <UserRound className="size-4" aria-hidden="true" />}
          </div>
          <label className="min-w-0 flex-1">
            <span className="sr-only">ผู้ใช้ปัจจุบัน</span>
            <select
              value={currentUser}
              onChange={(event) => setCurrentUser(event.target.value)}
              className={`${inputClass} cursor-pointer font-semibold`}
            >
              <option value="">เลือกผู้ใช้</option>
              {members.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-slate-100 px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-primary-light">
          <span>งานของฉัน</span>
          <input
            type="checkbox"
            checked={mine}
            onChange={(event) => setFilter("mine", event.target.checked)}
            className="size-4 rounded border-slate-300 bg-white text-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

      <div className="mt-auto border-t border-border p-3">
        <p className="mt-6 px-1 pb-2 text-xs font-bold uppercase tracking-wide text-muted">
          เครื่องมือข้อมูล
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          className="hidden"
          onChange={handleImportFile}
        />
        <div className="grid gap-2">
          <Button variant="primary" onClick={handleSeed} className="w-full">
            <RefreshCw className="size-4" aria-hidden="true" />
            <span>โหลดข้อมูลจริงของทีม</span>
          </Button>
          <Button variant="ghost" onClick={handleImportClick} className="w-full">
            <FileUp className="size-4" aria-hidden="true" />
            <span>Import CSV/JSON</span>
          </Button>
          <Button variant="ghost" onClick={handleExportCsv} className="w-full">
            <FileDown className="size-4" aria-hidden="true" />
            <span>Export CSV</span>
          </Button>
          <Button variant="ghost" onClick={handleExportJson} className="w-full">
            <FileText className="size-4" aria-hidden="true" />
            <span>Export JSON</span>
          </Button>
        </div>
      </div>
      </aside>
    </>
  );
}

function importConfirmText(customers: number, items: number) {
  return `นำเข้า ${customers} ลูกค้า / ${items} ชิ้นงาน — เขียนทับข้อมูลปัจจุบัน?`;
}

function getJsonPreview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("โครงสร้างข้อมูลไม่ถูกต้อง");
  }

  const candidate = value as Partial<Store>;
  if (!Array.isArray(candidate.customers) || !Array.isArray(candidate.items)) {
    throw new Error("โครงสร้างข้อมูลไม่ถูกต้อง");
  }

  return { customers: candidate.customers.length, items: candidate.items.length };
}
