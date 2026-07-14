"use client";

import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import {
  achievedPercent,
  customerHealth,
  customerProgress,
  customerRevenue,
  groupItemsByCustomer,
  itemsExpired,
  itemsExpiringSoon,
  itemsReportNotSent,
  itemsResultsNotCollected,
} from "@/lib/derived";
import { useStore } from "@/lib/store";
import type { Customer, Item } from "@/lib/types";
import { emptyCardClass } from "@/components/ui";
import { can, type AppRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { CustomerEditModal } from "./CustomerEditModal";
import { CustomerList, type CustomerRow, type SortKey } from "./customers/CustomerList";
import { CustomerDetailPane } from "./customers/CustomerDetailPane";

// Which modal is open, and in which mode — reuses CustomerEditModal for both
// "add customer" (customerId omitted) and "edit" (customerId set), matching
// how ItemModal already reuses one modal for create+edit.
type ModalState = { mode: "create" } | { mode: "edit"; customerId: string };

export function CustomersView({ role }: { role: AppRole | null }) {
  const customers = useStore((state) => state.customers);
  const items = useStore((state) => state.items);
  const setFilter = useStore((state) => state.setFilter);
  const setView = useStore((state) => state.setView);
  const openCustomerReport = useStore((state) => state.openCustomerReport);
  const deleteCustomer = useStore((state) => state.deleteCustomer);

  const [modalState, setModalState] = useState<ModalState | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");

  const itemsByCustomer = useMemo(() => new Map(groupItemsByCustomer(items)), [items]);

  // RLS only allows customer deletes for admin/manager — standalone mode (no
  // Supabase, no RLS) keeps delete available exactly as it works today, same
  // rule shape as ReportView's owner-quota gate.
  const canDeleteCustomer = !isSupabaseConfigured() || can(role, "customers.delete");

  // per-customer "ค้าง/โอกาส" tally — who needs chasing (unsent report / uncollected
  // result / expiring / expired-renewal).
  const attentionByCustomer = useMemo(() => {
    const today = new Date();
    const tally = new Map<string, number>();
    const bump = (list: Item[]) => {
      for (const item of list) tally.set(item.customerId, (tally.get(item.customerId) || 0) + 1);
    };
    bump(itemsReportNotSent(items));
    bump(itemsResultsNotCollected(items));
    bump(itemsExpiringSoon(items, today));
    bump(itemsExpired(items, today));
    return tally;
  }, [items]);

  // Per-customer account-health scorecard (tier/reason/revenueAtRisk) for the
  // detail pane's health chip — read-only reuse of the existing report-level
  // helper (same call shape ReportView uses for its CustomerHealthPanel).
  const customerHealthById = useMemo(
    () => new Map(customerHealth(items, customers, new Date()).map((row) => [row.customerId, row])),
    [items, customers],
  );

  const owners = useMemo(
    () =>
      [...new Set(customers.map((customer) => customer.salesOwner).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [customers],
  );
  const provinces = useMemo(
    () =>
      [...new Set(customers.map((customer) => customer.province).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, "th"),
      ),
    [customers],
  );

  const rows = useMemo<CustomerRow[]>(() => {
    const q = query.trim().toLowerCase();
    const enriched = customers
      .filter((customer) => (ownerFilter ? customer.salesOwner === ownerFilter : true))
      .filter((customer) => (provinceFilter ? customer.province === provinceFilter : true))
      .filter((customer) =>
        q ? `${customer.name} ${customer.province} ${customer.salesOwner}`.toLowerCase().includes(q) : true,
      )
      .map<CustomerRow>((customer) => ({
        customer,
        itemCount: itemsByCustomer.get(customer.id)?.length || 0,
        revenue: customerRevenue(items, customer.id),
        progress: customerProgress(items, customer.id),
        achieved: achievedPercent(items, customer.id),
        attention: attentionByCustomer.get(customer.id) || 0,
      }));

    const sorters: Record<SortKey, (a: CustomerRow, b: CustomerRow) => number> = {
      name: (a, b) => a.customer.name.localeCompare(b.customer.name, "th"),
      revenue: (a, b) => b.revenue - a.revenue,
      items: (a, b) => b.itemCount - a.itemCount,
      attention: (a, b) => b.attention - a.attention,
      achieved: (a, b) => b.achieved - a.achieved,
      progress: (a, b) => b.progress - a.progress,
    };
    return enriched.sort(sorters[sortKey]);
  }, [customers, items, itemsByCustomer, attentionByCustomer, query, ownerFilter, provinceFilter, sortKey]);

  const totalRevenue = useMemo(() => rows.reduce((sum, row) => sum + row.revenue, 0), [rows]);
  const totalAttention = useMemo(() => rows.reduce((sum, row) => sum + row.attention, 0), [rows]);

  // Selection is local UI state only (no store change) — deliberately resolved
  // against the full `customers` list rather than the filtered `rows`, so an
  // already-open detail pane survives the selected customer being filtered
  // out of the list (matches typical master-detail / email-client behavior).
  const selectedCustomer = selectedCustomerId
    ? customers.find((candidate) => candidate.id === selectedCustomerId) ?? null
    : null;

  const openCustomerItems = (customerId: string) => {
    setFilter("customerId", customerId);
    setView("items");
  };

  const handleDeleteCustomer = (customer: Customer) => {
    const itemCount = items.filter((item) => item.customerId === customer.id).length;
    if (
      !window.confirm(
        `ลูกค้านี้มี ${itemCount.toLocaleString("th-TH")} ชิ้นงาน — ลบทั้งลูกค้าและงานทั้งหมด?`,
      )
    ) {
      return;
    }

    deleteCustomer(customer.id);
    setSelectedCustomerId(null);
  };

  if (!customers.length) {
    return <EmptyState />;
  }

  // Mobile: list <-> detail toggle driven entirely by selection state (no
  // separate "pane" state to keep in sync) — selecting a customer swaps to
  // the detail pane, the pane's back button clears the selection. Desktop
  // (lg+) always shows both panes side by side.
  const listPaneVisibility = selectedCustomerId ? "hidden lg:flex" : "flex";
  const detailPaneVisibility = selectedCustomerId ? "flex" : "hidden lg:flex";

  return (
    <>
      <div className="lg:flex lg:items-start lg:gap-4">
        <div className={`${listPaneVisibility} w-full flex-col lg:w-[380px] lg:shrink-0`}>
          <CustomerList
            rows={rows}
            totalRevenue={totalRevenue}
            totalAttention={totalAttention}
            query={query}
            onQueryChange={setQuery}
            ownerFilter={ownerFilter}
            onOwnerFilterChange={setOwnerFilter}
            provinceFilter={provinceFilter}
            onProvinceFilterChange={setProvinceFilter}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            owners={owners}
            provinces={provinces}
            selectedCustomerId={selectedCustomerId}
            onSelectCustomer={setSelectedCustomerId}
            onAddCustomer={() => setModalState({ mode: "create" })}
          />
        </div>

        <div className={`${detailPaneVisibility} w-full min-w-0 flex-col lg:flex-1`}>
          {selectedCustomer ? (
            <CustomerDetailPane
              customer={selectedCustomer}
              items={items}
              health={customerHealthById.get(selectedCustomer.id)}
              attention={attentionByCustomer.get(selectedCustomer.id) || 0}
              onBack={() => setSelectedCustomerId(null)}
              onEdit={() => setModalState({ mode: "edit", customerId: selectedCustomer.id })}
              onDelete={canDeleteCustomer ? () => handleDeleteCustomer(selectedCustomer) : undefined}
              onOpenReport={() => openCustomerReport(selectedCustomer.id)}
              onOpenItems={() => openCustomerItems(selectedCustomer.id)}
            />
          ) : (
            <div className={`${emptyCardClass} grid h-full min-h-[24rem] place-items-center`}>
              <Users className="size-8 text-slate-300" aria-hidden="true" />
              <p className="mt-3 font-semibold text-ink">เลือกลูกค้าเพื่อดูรายละเอียด</p>
              <p className="mt-1 text-sm text-muted">
                เลือกลูกค้าจากรายการทางซ้ายเพื่อดูข้อมูล ชิ้นงาน และสุขภาพบัญชี
              </p>
            </div>
          )}
        </div>
      </div>

      {modalState ? (
        <CustomerEditModal
          customerId={modalState.mode === "edit" ? modalState.customerId : null}
          onClose={() => setModalState(null)}
          role={role}
        />
      ) : null}
    </>
  );
}

function EmptyState() {
  return (
    <div className={`${emptyCardClass} grid place-items-center`}>
      <p className="font-semibold text-ink">ยังไม่มีลูกค้า</p>
      <p className="mt-1 text-sm text-muted">โหลดข้อมูลจริงของทีมเพื่อเริ่มต้น</p>
    </div>
  );
}
