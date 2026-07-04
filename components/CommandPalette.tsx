"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  CircleAlert,
  ClipboardList,
  FileDown,
  FileText,
  Plus,
  RefreshCw,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import { itemName } from "@/lib/derived";
import { downloadFile } from "@/lib/exportData";
import { filterPaletteCommands } from "@/lib/paletteSearch";
import { useStore, type AppViewKey } from "@/lib/store";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { cardClass } from "@/components/ui";

type Command = {
  key?: string;
  label: string;
  icon: typeof ClipboardList;
  run: () => void;
  // extra free-text the query should also match (name/province/qtNo/etc.) —
  // not shown in the label itself.
  keywords?: string;
  // only "item" entries get capped by filterPaletteCommands — see MAX_ITEM_RESULTS.
  group?: "customer" | "item";
};

// Item search results can run into the hundreds (130+ in this dataset); cap
// how many render so the palette stays fast and scannable. Customers (~34)
// and nav/action commands always render in full — see filterPaletteCommands.
const MAX_ITEM_RESULTS = 20;

const navCommands: { label: string; view: AppViewKey; icon: typeof ClipboardList }[] = [
  { label: "ไปหน้า สิ่งที่ต้องทำ", view: "home", icon: CircleAlert },
  { label: "ไปหน้า ชิ้นงาน", view: "items", icon: ClipboardList },
  { label: "ไปหน้า ลูกค้า", view: "customers", icon: Users },
  { label: "ไปหน้า Calendar", view: "calendar", icon: CalendarDays },
  { label: "ไปหน้า รายงาน", view: "report", icon: BarChart3 },
];

export function CommandPalette() {
  const isPaletteOpen = useStore((state) => state.isPaletteOpen);

  if (!isPaletteOpen) return null;

  return <CommandPaletteDialog />;
}

function CommandPaletteDialog() {
  const closePalette = useStore((state) => state.closePalette);
  const setView = useStore((state) => state.setView);
  const openItemModal = useStore((state) => state.openItemModal);
  const openCustomerReport = useStore((state) => state.openCustomerReport);
  const seedFromCsv = useStore((state) => state.seedFromCsv);
  const exportCsv = useStore((state) => state.exportCsv);
  const exportJson = useStore((state) => state.exportJson);
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const commands = useMemo<Command[]>(
    () => [
      ...navCommands.map((command) => ({
        label: command.label,
        icon: command.icon,
        run: () => setView(command.view),
      })),
      {
        label: "เพิ่มชิ้นงานใหม่",
        icon: Plus,
        run: () => openItemModal(),
      },
      {
        label: "โหลดข้อมูลจริงของทีม",
        icon: RefreshCw,
        run: () => {
          if (window.confirm("ข้อมูลปัจจุบันจะถูกแทนที่ด้วยข้อมูลจริงของทีม ต้องการดำเนินการต่อหรือไม่?")) {
            seedFromCsv();
          }
        },
      },
      {
        label: "Export CSV",
        icon: FileDown,
        run: () => {
          downloadFile("customer-communication-tracking.csv", exportCsv(), "text/csv;charset=utf-8");
        },
      },
      {
        label: "Export JSON",
        icon: FileText,
        run: () => {
          downloadFile(
            "customer-communication-backup.json",
            exportJson(),
            "application/json;charset=utf-8",
          );
        },
      },
      // One entry per customer — the fast escape from the "repetitive wall": type
      // a name and jump straight to that customer's dedicated report (revenue,
      // achieved%, item groups, interactions) instead of scrolling the full list.
      // openCustomerReport (not setFilter+setView("items")) is used because it is
      // the single richest "view this customer" surface already in the app — it's
      // the primary-styled action on the customer card in CustomersView, whereas
      // the filtered items list is still a wall, just scoped to one customer.
      ...customers.map((customer): Command => {
        const province = customer.province.trim();
        return {
          key: `customer-${customer.id}`,
          label: province ? `${customer.name} · ${province}` : customer.name,
          icon: UserRound,
          keywords: [customer.name, customer.province, customer.salesOwner].join(" "),
          group: "customer",
          run: () => openCustomerReport(customer.id),
        };
      }),
      // One entry per item — jumps straight into that item's edit modal.
      ...items.map((item): Command => {
        const customerName = customersById.get(item.customerId)?.name.trim() || "ไม่ระบุลูกค้า";
        const qtLabel = item.qtNo.trim() || "(ไม่มี QT)";
        return {
          key: `item-${item.id}`,
          label: `${customerName} · ${item.detail.trim() || itemName(item)} · ${qtLabel}`,
          icon: FileText,
          keywords: [customerName, item.itemType, item.detail, item.qtNo, item.invNo].join(" "),
          group: "item",
          run: () => openItemModal(item.id),
        };
      }),
    ],
    [
      customers,
      customersById,
      exportCsv,
      exportJson,
      items,
      openCustomerReport,
      openItemModal,
      seedFromCsv,
      setView,
    ],
  );

  const filteredCommands = useMemo(
    () => filterPaletteCommands(commands, query, MAX_ITEM_RESULTS),
    [commands, query],
  );
  const activeIndex = Math.min(highlightedIndex, Math.max(filteredCommands.length - 1, 0));

  // useFocusTrap must run BEFORE the initial-focus effect below so its effect
  // captures the real trigger (document.activeElement at mount) — if it ran
  // after, focus would already have moved to searchRef by the time it
  // captured `previouslyFocused`, so closing the palette would restore focus
  // to the (unmounted) search input instead of the trigger, dropping it to
  // <body>.
  useFocusTrap(containerRef);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const runCommand = (command: Command | undefined) => {
    if (!command) return;

    try {
      command.run();
    } finally {
      closePalette();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        filteredCommands.length ? (current + 1) % filteredCommands.length : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        filteredCommands.length
          ? (current - 1 + filteredCommands.length) % filteredCommands.length
          : 0,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(filteredCommands[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closePalette();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Command palette"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-start bg-black/50 px-4 py-20 sm:place-items-center sm:py-4"
      onKeyDown={handleKeyDown}
    >
      <div ref={containerRef} className={`w-full max-w-xl overflow-hidden ${cardClass}`}>
        <div className="border-b border-border p-3">
          <label className="relative block">
            <span className="sr-only">ค้นหาคำสั่ง</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlightedIndex(0);
              }}
              autoFocus
              placeholder="ค้นหาคำสั่ง…"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-24 text-sm text-ink outline-none transition placeholder:text-muted hover:border-slate-400 focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-100"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-border bg-slate-100 px-2 py-1 text-xs font-semibold text-muted">
              Ctrl/⌘K
            </span>
          </label>
        </div>

        <div className="max-h-80 overflow-y-auto p-2" role="listbox" aria-label="คำสั่ง">
          {filteredCommands.length ? (
            filteredCommands.map((command, index) => {
              const Icon = command.icon;
              const highlighted = activeIndex === index;

              return (
                <button
                  key={command.key ?? command.label}
                  type="button"
                  role="option"
                  aria-selected={highlighted}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => runCommand(command)}
                  className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors ${
                    highlighted ? "bg-primary-light text-primary-dark" : "text-slate-700 hover:bg-primary-light"
                  }`}
                >
                  <Icon
                    className={`size-4 shrink-0 ${highlighted ? "text-primary-dark" : "text-muted"}`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{command.label}</span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-sm font-medium text-muted">ไม่พบคำสั่ง</p>
          )}
        </div>
      </div>
    </div>
  );
}
