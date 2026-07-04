"use client";

import { Copy } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { StatusBadges } from "@/components/StatusBadges";
import { Chip, cardClass } from "@/components/ui";
import { STATUS_DIMS } from "@/lib/constants";
import { filteredItems, itemName, money, parseDate } from "@/lib/derived";
import { execToProgress } from "@/lib/normalize";
import { useStore } from "@/lib/store";
import type { ExecStatus, Item } from "@/lib/types";

const cardDateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatCardDate(value: string) {
  const date = parseDate(value);
  return date ? cardDateFormatter.format(date) : "ไม่ระบุวันที่";
}

export function BoardView() {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const filters = useStore((state) => state.filters);
  const settings = useStore((state) => state.settings);
  const calDateField = useStore((state) => state.calDateField);
  const statusDim = useStore((state) => state.statusDim);
  const boardDim = useStore((state) => state.boardDim);
  const updateItem = useStore((state) => state.updateItem);
  const openItemModal = useStore((state) => state.openItemModal);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleItems = useMemo(
    () =>
      filteredItems({
        customers,
        items,
        settings,
        filters,
        calDateField,
        statusDim,
      }),
    [customers, items, settings, filters, calDateField, statusDim],
  );
  const dim = STATUS_DIMS[boardDim];
  const columns = useMemo(
    () =>
      dim.list.map((status) => ({
        status,
        items: visibleItems.filter((item) => item[dim.field] === status.key),
      })),
    [dim, visibleItems],
  );

  function handleDragStart(itemId: string, event: DragEvent<HTMLElement>) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", itemId);
  }

  function handleDragOver(statusKey: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverKey(statusKey);
  }

  function handleDragLeave(statusKey: string, event: DragEvent<HTMLElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    setDragOverKey((current) => (current === statusKey ? null : current));
  }

  function handleDrop(statusKey: string, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setDragOverKey(null);

    const itemId = event.dataTransfer.getData("text/plain");
    const item = itemById.get(itemId);
    if (!item || item[dim.field] === statusKey) return;

    const patch = { [dim.field]: statusKey } as Partial<Item>;
    if (boardDim === "exec") {
      patch.progress = execToProgress(statusKey as ExecStatus);
    }
    updateItem(itemId, patch);
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">
      {columns.map(({ status, items: columnItems }) => (
        <section
          key={status.key}
          className={`flex w-72 shrink-0 flex-col rounded-xl border shadow-card transition-colors sm:w-80 ${
            dragOverKey === status.key
              ? "border-brand-300 bg-primary-light ring-2 ring-brand-100"
              : "border-border-soft bg-slate-50/80"
          }`}
          onDragOver={(event) => handleDragOver(status.key, event)}
          onDragLeave={(event) => handleDragLeave(status.key, event)}
          onDrop={(event) => handleDrop(status.key, event)}
        >
          <header className="flex items-center justify-between gap-3 rounded-t-xl border-b border-border bg-white/60 px-4 py-3">
            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: status.dot }}
                aria-hidden="true"
              />
              <span className="truncate">{status.label}</span>
            </span>
            <Chip tone="muted" className="shrink-0 tnum">
              {columnItems.length.toLocaleString("th-TH")}
            </Chip>
          </header>

          <div className="flex min-h-64 flex-1 flex-col gap-3 p-3">
            {columnItems.length ? (
              columnItems.map((item) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  customerName={customerById.get(item.customerId)?.name || "ไม่ระบุลูกค้า"}
                  onDragStart={(event) => handleDragStart(item.id, event)}
                  onDragEnd={() => setDragOverKey(null)}
                  onOpen={() => openItemModal(item.id)}
                />
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-8 text-center text-sm text-muted">
                วางชิ้นงานที่นี่
              </p>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function BoardCard({
  item,
  customerName,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  item: Item;
  customerName: string;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const openItemModal = useStore((state) => state.openItemModal);
  const duplicateItem = useStore((state) => state.duplicateItem);

  // Differentiator-first, same rule as ItemRow: detail leads as the bold
  // headline (board cards are tiny — this is the biggest "same type every
  // card" offender), itemType only fills in when detail is empty.
  const detail = item.detail.trim();
  const headline = detail || itemName(item);
  const showTypeChip = Boolean(detail && item.itemType.trim());
  const governingDate = item.publishDate || item.deadline;

  const handleDuplicate = () => {
    const newId = duplicateItem(item.id);
    if (newId) openItemModal(newId);
  };

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab select-none p-3 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg active:cursor-grabbing ${cardClass}`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full pr-7 text-left focus:outline-none focus:ring-2 focus:ring-brand-100"
        aria-label={`แก้ไขชิ้นงาน ${headline}`}
      >
        {showTypeChip ? (
          <Chip tone="muted" className="mb-1">
            {itemName(item)}
          </Chip>
        ) : null}
        <h3 className="line-clamp-2 text-sm font-semibold leading-6 text-ink">{headline}</h3>
        <p className="mt-1 truncate text-xs text-muted">{customerName}</p>
        {governingDate ? (
          <p className="tnum mt-1 text-xs text-muted">{formatCardDate(governingDate)}</p>
        ) : null}
        <div className="mt-3">
          <StatusBadges item={item} />
        </div>
        <p className="mt-3 text-right text-sm font-semibold text-ink tnum">
          {money(item.price)}
        </p>
      </button>

      <button
        type="button"
        onClick={handleDuplicate}
        className="absolute right-2 top-2 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100 focus-visible:opacity-100 group-hover:opacity-100"
        aria-label={`ทำซ้ำ ${itemName(item)}`}
        title="ทำซ้ำชิ้นงาน"
      >
        <Copy className="size-3.5" aria-hidden="true" />
      </button>
    </article>
  );
}
