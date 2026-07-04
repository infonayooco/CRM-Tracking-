"use client";

import { Filter, X } from "lucide-react";
import { useMemo } from "react";
import { activeFilterChips } from "@/lib/derived";
import { useStore } from "@/lib/store";
import { Chip } from "@/components/ui";

export function ActiveFilterBar() {
  const customers = useStore((state) => state.customers);
  const filters = useStore((state) => state.filters);
  const settings = useStore((state) => state.settings);
  const statusDim = useStore((state) => state.statusDim);
  const boardDim = useStore((state) => state.boardDim);
  const clearFilter = useStore((state) => state.clearFilter);
  const resetFilters = useStore((state) => state.resetFilters);

  const chips = useMemo(
    () =>
      activeFilterChips({
        customers,
        filters,
        settings,
        statusDim,
        boardDim,
      }),
    [boardDim, customers, filters, settings, statusDim],
  );

  if (!chips.length) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning-light px-3 py-2.5 text-warning-dark shadow-soft">
      <div className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold">
        <Filter className="size-4" aria-hidden="true" />
        <span>
          กำลังกรอง <span className="tnum">{chips.length.toLocaleString("th-TH")}</span> เงื่อนไข
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {chips.map((chip) => (
          <Chip key={chip.key} tone="warning" className="max-w-full gap-1.5 pr-1">
            <span className="max-w-72 truncate">{chip.label}</span>
            <button
              type="button"
              onClick={() => clearFilter(chip.key)}
              className="grid size-4 shrink-0 cursor-pointer place-items-center rounded-full text-warning-dark/70 hover:bg-white/70 hover:text-warning-dark focus:outline-none focus:ring-2 focus:ring-brand-100"
              aria-label="ลบตัวกรองนี้"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </Chip>
        ))}

        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex h-6 cursor-pointer items-center rounded-lg border border-warning/40 bg-white px-2.5 text-xs font-semibold text-warning-dark hover:bg-warning-light focus:outline-none focus:ring-2 focus:ring-brand-100"
        >
          ล้างทั้งหมด
        </button>
      </div>
    </div>
  );
}
