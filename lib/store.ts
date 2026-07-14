"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { STORAGE_KEY, STORE_VERSION } from "./constants";
import { serializeTeamCsv } from "./exportData";
import { normalizeCustomer, normalizeItem, normalizeStore, nowISO, uid } from "./normalize";
import { parseTeamCsv } from "./parseTeamCsv";
import { SEED_CSV } from "./seedCsv";
import type {
  CalDateField,
  Customer,
  Filters,
  InteractionType,
  Item,
  StatusDimKey,
  Store,
  ViewKey as BaseViewKey,
} from "./types";

export const defaultFilters: Filters = {
  q: "",
  customerId: "",
  qtNo: "",
  channel: "",
  itemType: "",
  salesOwner: "",
  province: "",
  statusKey: "",
  mine: false,
  overdue: false,
  dateFrom: "",
  dateTo: "",
};

type ViewMode = "list" | "board";
type LastDeleted = { item: Item; index: number };
// Snapshot for undoing a customer deletion — the customer plus every item that
// cascaded with it, each with its original array index for faithful restore.
type DeletedCustomer = {
  customer: Customer;
  customerIndex: number;
  items: { item: Item; index: number }[];
};
export type AppViewKey = BaseViewKey | "home" | "timeline";
type ViewPrefs = {
  view: AppViewKey;
  viewMode: ViewMode;
  boardDim: StatusDimKey;
  statusDim: StatusDimKey;
  calDateField: CalDateField;
  // the "งานของฉัน" scope is a filter, but it is a durable personal preference —
  // persisted (unlike search/customer filters) so a refresh keeps the rep's view.
  mine: boolean;
  // true once the true first-run seed has happened — persisted so an intentionally
  // emptied board is never mistaken for a fresh install and re-seeded on reload.
  initialized: boolean;
  // per-owner monthly revenue quota, keyed by sales-owner name — persisted so the
  // target set for the owner-performance panel survives a refresh.
  ownerQuotas: Record<string, number>;
};
type PersistedStore = Store & Partial<ViewPrefs>;

export interface StoreState extends Store {
  filters: Filters;
  view: AppViewKey;
  viewMode: ViewMode;
  boardDim: StatusDimKey;
  calDateField: CalDateField;
  statusDim: StatusDimKey;
  initialized: boolean;
  ownerQuotas: Record<string, number>;
  // Registered-account roster for the assignee dropdown, loaded by
  // lib/data/sync.ts hydrateFromSupabase() via setTeamRoster(). Read-only for
  // everything else; empty (and the app still works) in standalone mode or if
  // the RPC fails. Never persisted to localStorage — see partialize below.
  teamRoster: string[];
  modalItemId: string | null;
  isItemModalOpen: boolean;
  // Transient prefill for a contextual "add item" (e.g. from a QT header) —
  // applied only to a NEW item's form defaults, never persisted, and cleared
  // whenever the modal closes so it can never leak into the next blank add.
  newItemPrefill: Partial<Item> | null;
  isPaletteOpen: boolean;
  reportCustomerId: string | null;
  lastDeleted: LastDeleted | null;
  lastDeletedCustomer: DeletedCustomer | null;
  seedFromCsv: () => void;
  importFromCsv: (text: string) => void;
  importFromJson: (obj: unknown) => void;
  exportCsv: () => string;
  exportJson: () => string;
  addItem: (item: Partial<Item> & { customerId: string; itemType: string }) => string;
  updateItem: (id: string, patch: Partial<Item>) => void;
  updateItems: (ids: string[], patch: Partial<Item>) => void;
  deleteItem: (id: string) => void;
  undoDelete: () => void;
  dismissUndo: () => void;
  duplicateItem: (id: string) => string | null;
  upsertCustomer: (customer: Partial<Customer> & { name: string }) => string;
  updateCustomer: (id: string, patch: Partial<Customer>) => void;
  addInteraction: (customerId: string, entry: { type: InteractionType; note: string; date?: string }) => void;
  deleteInteraction: (customerId: string, interactionId: string) => void;
  deleteCustomer: (id: string) => void;
  undoDeleteCustomer: () => void;
  mergeCustomers: (sourceId: string, targetId: string) => void;
  setView: (view: AppViewKey) => void;
  setViewMode: (mode: ViewMode) => void;
  setBoardDim: (key: StatusDimKey) => void;
  setFilter: <K extends keyof Filters>(key: K, value: Filters[K]) => void;
  clearFilter: (key: keyof Filters) => void;
  setFilters: (filters: Partial<Filters>) => void;
  resetFilters: () => void;
  setCurrentUser: (currentUser: string) => void;
  setCalDateField: (field: CalDateField) => void;
  setStatusDim: (key: StatusDimKey) => void;
  setOwnerQuota: (owner: string, amount: number) => void;
  addMember: (name: string) => void;
  // Hydration-only setter — call from lib/data/sync.ts, not from UI code.
  setTeamRoster: (names: string[]) => void;
  openItemModal: (id?: string | null) => void;
  openNewItem: (prefill?: Partial<Item>) => void;
  closeItemModal: () => void;
  openPalette: () => void;
  closePalette: () => void;
  openCustomerReport: (id: string) => void;
  closeCustomerReport: () => void;
}

// localStorage writes can fail (quota exceeded, privacy mode). We surface that
// through a listener channel rather than the store itself — writing to the store
// here would just retrigger the failing persist write. Components subscribe to
// warn the user to Export JSON before an edit is lost on the next reload.
type StorageErrorListener = () => void;
let storageErrorListeners: StorageErrorListener[] = [];
export function onStorageError(listener: StorageErrorListener) {
  storageErrorListeners = [...storageErrorListeners, listener];
  return () => {
    storageErrorListeners = storageErrorListeners.filter((entry) => entry !== listener);
  };
}
function emitStorageError() {
  for (const listener of storageErrorListeners) listener();
}

// Tracks the exact string this tab last wrote to localStorage, so the
// cross-tab "storage" listener (below) can tell its own echoed write apart
// from a genuine change made by another tab.
let lastWrittenRaw: string | null = null;

// In Supabase mode the DB is the source of truth, so we must NOT mirror CRM data
// into localStorage (it would leak PII, survive sign-out, and could be replayed
// into a later unauthenticated render). This flag disables the read/write path;
// removeItem stays active so the cache can be cleared. removeItem is never gated.
let localPersistDisabled = false;
export function setLocalPersistDisabled(disabled: boolean) {
  localPersistDisabled = disabled;
}

const rawStoreStorage: PersistStorage<PersistedStore> = {
  getItem(name): StorageValue<PersistedStore> | null {
    if (typeof window === "undefined" || localPersistDisabled) return null;
    const raw = window.localStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<Store> | StorageValue<Partial<Store>>;
      const state = isStorageValue(parsed) ? parsed.state : parsed;
      const prefs = state as Partial<StoreState> & Partial<ViewPrefs>;
      return {
        // normalize the data, but carry the persisted view prefs through so a
        // refresh restores the last page (merge() validates them).
        state: {
          ...normalizeStore(state),
          view: prefs.view,
          viewMode: prefs.viewMode,
          boardDim: prefs.boardDim,
          statusDim: prefs.statusDim,
          calDateField: prefs.calDateField,
          mine: prefs.mine,
          initialized: prefs.initialized,
          ownerQuotas: prefs.ownerQuotas,
        },
        version: state.version || STORE_VERSION,
      };
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    if (typeof window === "undefined" || localPersistDisabled) return;
    try {
      const serialized = JSON.stringify({ ...value.state, version: STORE_VERSION });
      window.localStorage.setItem(name, serialized);
      lastWrittenRaw = serialized;
    } catch {
      // quota exceeded / storage unavailable — the in-memory edit survives for now,
      // but it won't outlast a reload, so warn the user to export a backup.
      emitStorageError();
    }
  },
  removeItem(name) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

// Two tabs of this app each hold independent in-memory state. When tab A
// saves, tab B is unaware and its next write would silently clobber A's
// change. The browser's "storage" event fires in every OTHER tab (never the
// writer's own tab) whenever our key changes, so we use it to rehydrate this
// tab's store from the freshly written localStorage value.
export function subscribeCrossTabSync(): () => void {
  if (typeof window === "undefined") return () => {};

  function handleStorage(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue == null) return; // key cleared/removed — nothing to sync
    // Echo guard: if this exact string is what we last wrote ourselves, this
    // event is our own write reflected back (or an identical no-op write from
    // elsewhere) — rehydrating here would be a no-op that could still trigger
    // another persist write, which would fire another storage event, and so
    // on. Returning early breaks that potential rehydrate <-> rewrite loop.
    if (event.newValue === lastWrittenRaw) return;
    lastWrittenRaw = event.newValue;
    void useStore.persist.rehydrate();
  }

  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener("storage", handleStorage);
  };
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      version: STORE_VERSION,
      customers: [],
      items: [],
      members: [],
      settings: { currentUser: "" },
      filters: defaultFilters,
      view: "home",
      viewMode: "list",
      boardDim: "exec",
      calDateField: "publishDate",
      statusDim: "exec",
      initialized: false,
      ownerQuotas: {},
      teamRoster: [],
      modalItemId: null,
      isItemModalOpen: false,
      newItemPrefill: null,
      isPaletteOpen: false,
      reportCustomerId: null,
      lastDeleted: null,
      lastDeletedCustomer: null,

      seedFromCsv() {
        const parsed = parseTeamCsv(SEED_CSV);
        set({
          version: STORE_VERSION,
          customers: parsed.customers,
          items: parsed.items,
          members: parsed.members,
          settings: { currentUser: parsed.members[0] || "" },
        });
      },

      importFromCsv(text) {
        const parsed = parseTeamCsv(text);
        set({
          version: STORE_VERSION,
          customers: parsed.customers,
          items: parsed.items,
          members: parsed.members,
          settings: { currentUser: parsed.members[0] || "" },
        });
      },

      importFromJson(obj) {
        const imported = normalizeImportStore(obj);
        set(toPersistedStore(imported));
      },

      exportCsv() {
        const state = get();
        return serializeTeamCsv(state.customers, state.items);
      },

      exportJson() {
        return JSON.stringify(toPersistedStore(get()), null, 2);
      },

      addItem(item) {
        const ids = new Set(get().customers.map((customer) => customer.id));
        const normalized = normalizeItem(
          {
            ...item,
            id: item.id || uid("item"),
            createdAt: item.createdAt || nowISO(),
            updatedAt: nowISO(),
            activity: item.activity || [{ ts: nowISO(), text: "สร้างชิ้นงานใหม่" }],
          },
          ids,
        );
        set((state) => ({ items: [...state.items, normalized] }));
        return normalized.id;
      },

      updateItem(id, patch) {
        const ids = new Set(get().customers.map((customer) => customer.id));
        set((state) => ({
          items: state.items.map((item) =>
            item.id === id ? applyItemPatch(item, patch, "แก้ไขรายละเอียดชิ้นงาน", ids) : item,
          ),
        }));
      },

      updateItems(ids, patch) {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        const customerIds = new Set(get().customers.map((customer) => customer.id));
        set((state) => ({
          items: state.items.map((item) =>
            idSet.has(item.id)
              ? applyItemPatch(item, patch, "แก้ไขหลายรายการพร้อมกัน", customerIds)
              : item,
          ),
        }));
      },

      deleteItem(id) {
        set((state) => {
          const index = state.items.findIndex((item) => item.id === id);
          if (index === -1) return {};

          return {
            items: state.items.filter((_, itemIndex) => itemIndex !== index),
            lastDeleted: { item: state.items[index], index },
            lastDeletedCustomer: null,
          };
        });
      },

      undoDelete() {
        set((state) => {
          if (!state.lastDeleted) return {};

          const insertAt = Math.min(Math.max(state.lastDeleted.index, 0), state.items.length);
          return {
            items: [
              ...state.items.slice(0, insertAt),
              state.lastDeleted.item,
              ...state.items.slice(insertAt),
            ],
            lastDeleted: null,
          };
        });
      },

      dismissUndo() {
        set({ lastDeleted: null, lastDeletedCustomer: null });
      },

      duplicateItem(id) {
        let duplicatedId: string | null = null;
        set((state) => {
          const index = state.items.findIndex((item) => item.id === id);
          if (index === -1) return {};

          const item = state.items[index];
          const ids = new Set(state.customers.map((customer) => customer.id));
          const activity = item.activity.length
            ? [...item.activity, { ts: nowISO(), text: "ทำซ้ำชิ้นงาน" }]
            : item.activity;
          // itemType stays clean (no "(สำเนา)" suffix) — the rep edits the copy's
          // differentiating fields (detail/date) immediately, and a clean itemType
          // keeps grouping/analytics (salesByItemType, itemTypePerformance, etc.)
          // from splintering into duplicate-suffixed variants.
          const duplicated = normalizeItem(
            {
              ...item,
              id: uid("item"),
              activity,
            },
            ids,
          );
          duplicatedId = duplicated.id;

          return {
            items: [
              ...state.items.slice(0, index + 1),
              duplicated,
              ...state.items.slice(index + 1),
            ],
          };
        });
        return duplicatedId;
      },

      upsertCustomer(customer) {
        const current = get();
        const normalized = normalizeCustomer(customer);
        const existing =
          (customer.id && current.customers.find((candidate) => candidate.id === customer.id)) ||
          current.customers.find((candidate) => {
            if (candidate.name.trim() !== normalized.name.trim()) return false;
            const existingProvince = candidate.province.trim();
            const nextProvince = normalized.province.trim();
            // reuse the existing record when the name matches and provinces are
            // compatible (identical, or either side left blank) — so "ถ้าเคยมีให้ใช้อันเดิม"
            return existingProvince === nextProvince || !existingProvince || !nextProvince;
          });
        const customerId = existing?.id || normalized.id;
        // Reusing an existing customer must only ever UPDATE name/province/salesOwner
        // when a non-empty value was supplied — spreading the full `normalized` here
        // would blank out the existing contactPerson/phone/lineId/color and reset
        // createdAt, since normalizeCustomer fills every unspecified field with a
        // default. A brand-new customer has no prior record to preserve, so it keeps
        // `normalized` as-is.
        // province and provinceCode must move together (a valid code is authoritative
        // and its name is derived) — sourcing them from the same object keeps them in
        // sync and avoids the stale-code desync the province migration warned about.
        const provinceSupplied = Boolean(normalized.province);
        const nextCustomer = existing
          ? {
              ...existing,
              name: normalized.name || existing.name,
              province: provinceSupplied ? normalized.province : existing.province,
              provinceCode: provinceSupplied ? normalized.provinceCode : existing.provinceCode,
              salesOwner: normalized.salesOwner || existing.salesOwner,
            }
          : normalized;
        set((state) => ({
          customers: existing
            ? state.customers.map((candidate) => (candidate.id === customerId ? nextCustomer : candidate))
            : [...state.customers, nextCustomer],
          members:
            nextCustomer.salesOwner && !state.members.includes(nextCustomer.salesOwner)
              ? [...state.members, nextCustomer.salesOwner]
              : state.members,
        }));
        return customerId;
      },

      updateCustomer(id, patch) {
        const trimmedPatch = trimCustomerPatch(patch);
        set((state) => {
          let nextSalesOwner = "";
          const customers = state.customers.map((customer) => {
            if (customer.id !== id) return customer;
            const nextCustomer = normalizeCustomer({
              ...customer,
              ...trimmedPatch,
              id: customer.id,
              createdAt: customer.createdAt,
            });
            nextSalesOwner = nextCustomer.salesOwner;
            return nextCustomer;
          });

          return {
            customers,
            members:
              nextSalesOwner && !state.members.includes(nextSalesOwner)
                ? [...state.members, nextSalesOwner]
                : state.members,
          };
        });
      },

      addInteraction(customerId, entry) {
        const note = entry.note.trim();
        if (!note) return;
        set((state) => {
          const exists = state.customers.some((customer) => customer.id === customerId);
          if (!exists) return {};

          const nextEntry = {
            id: uid("intx"),
            date: entry.date || nowISO().slice(0, 10),
            type: entry.type,
            note,
          };
          return {
            customers: state.customers.map((customer) =>
              customer.id === customerId
                ? { ...customer, interactions: [nextEntry, ...customer.interactions] }
                : customer,
            ),
          };
        });
      },

      deleteInteraction(customerId, interactionId) {
        set((state) => ({
          customers: state.customers.map((customer) =>
            customer.id === customerId
              ? {
                  ...customer,
                  interactions: customer.interactions.filter((entry) => entry.id !== interactionId),
                }
              : customer,
          ),
        }));
      },

      deleteCustomer(id) {
        set((state) => {
          const customerIndex = state.customers.findIndex((customer) => customer.id === id);
          if (customerIndex === -1) return {};

          const customer = state.customers[customerIndex];
          // capture in ascending index order so undo can splice them back faithfully
          const removedItems = state.items
            .map((item, index) => ({ item, index }))
            .filter((entry) => entry.item.customerId === id);

          return {
            customers: state.customers.filter((candidate) => candidate.id !== id),
            items: state.items.filter((item) => item.customerId !== id),
            lastDeletedCustomer: { customer, customerIndex, items: removedItems },
            lastDeleted: null,
          };
        });
      },

      undoDeleteCustomer() {
        set((state) => {
          if (!state.lastDeletedCustomer) return {};

          const { customer, customerIndex, items } = state.lastDeletedCustomer;
          const customers = [...state.customers];
          customers.splice(Math.min(Math.max(customerIndex, 0), customers.length), 0, customer);

          // re-insert items at ascending original indices — each splice accounts
          // for the earlier ones already restored, reconstructing the order.
          const nextItems = [...state.items];
          for (const { item, index } of items) {
            nextItems.splice(Math.min(Math.max(index, 0), nextItems.length), 0, item);
          }

          return { customers, items: nextItems, lastDeletedCustomer: null };
        });
      },

      mergeCustomers(sourceId, targetId) {
        if (sourceId === targetId) return;

        set((state) => {
          const hasSource = state.customers.some((customer) => customer.id === sourceId);
          const hasTarget = state.customers.some((customer) => customer.id === targetId);
          if (!hasSource || !hasTarget) return {};

          return {
            customers: state.customers.filter((customer) => customer.id !== sourceId),
            items: state.items.map((item) =>
              item.customerId === sourceId ? { ...item, customerId: targetId } : item,
            ),
          };
        });
      },

      setView(view) {
        set({ view });
      },
      setViewMode(mode) {
        set({ viewMode: mode });
      },
      setBoardDim(key) {
        set({ boardDim: key });
      },
      setFilter(key, value) {
        set((state) => ({ filters: { ...state.filters, [key]: value } }));
      },
      clearFilter(key) {
        set((state) => ({ filters: { ...state.filters, [key]: defaultFilters[key] } }));
      },
      setFilters(filters) {
        set((state) => ({ filters: { ...state.filters, ...filters } }));
      },
      resetFilters() {
        set({ filters: defaultFilters });
      },
      setCurrentUser(currentUser) {
        set((state) => ({ settings: { ...state.settings, currentUser } }));
      },
      setCalDateField(field) {
        set({ calDateField: field });
      },
      setStatusDim(key) {
        set((state) => ({ statusDim: key, filters: { ...state.filters, statusKey: "" } }));
      },
      setOwnerQuota(owner, amount) {
        const trimmedOwner = owner.trim();
        if (!trimmedOwner) return;
        set((state) => {
          if (!(amount > 0)) {
            // 0, negative, or NaN clears the quota — keep the stored object clean
            // rather than persisting a zero/garbage entry.
            const rest = { ...state.ownerQuotas };
            delete rest[trimmedOwner];
            return { ownerQuotas: rest };
          }
          return { ownerQuotas: { ...state.ownerQuotas, [trimmedOwner]: amount } };
        });
      },
      addMember(name) {
        const trimmed = name.trim();
        if (!trimmed) return;
        // exact-match dedupe, consistent with the existing salesOwner auto-add
        // in upsertCustomer/updateCustomer above (state.members.includes(...)).
        set((state) => (state.members.includes(trimmed) ? {} : { members: [...state.members, trimmed] }));
      },
      setTeamRoster(names) {
        set({ teamRoster: names });
      },
      openItemModal(id = null) {
        set({ modalItemId: id, isItemModalOpen: true });
      },
      openNewItem(prefill) {
        set({ newItemPrefill: prefill ?? null, modalItemId: null, isItemModalOpen: true });
      },
      closeItemModal() {
        set({ modalItemId: null, isItemModalOpen: false, newItemPrefill: null });
      },
      openPalette() {
        set({ isPaletteOpen: true });
      },
      closePalette() {
        set({ isPaletteOpen: false });
      },
      openCustomerReport(id) {
        set({ reportCustomerId: id });
      },
      closeCustomerReport() {
        set({ reportCustomerId: null });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: rawStoreStorage,
      version: STORE_VERSION,
      skipHydration: true,
      partialize: (state) => ({
        version: STORE_VERSION,
        customers: state.customers,
        items: state.items,
        members: state.members,
        settings: state.settings,
        // persist the current page + view prefs so a refresh stays put
        view: state.view,
        viewMode: state.viewMode,
        boardDim: state.boardDim,
        statusDim: state.statusDim,
        calDateField: state.calDateField,
        mine: state.filters.mine,
        initialized: state.initialized,
        ownerQuotas: state.ownerQuotas,
      }),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<StoreState> & Partial<ViewPrefs>;
        const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
          allowed.includes(value as T) ? (value as T) : fallback;
        return {
          ...current,
          ...normalizeStore(p as Partial<Store>),
          // restore last-viewed page + view prefs (refresh stays on the same page)
          view: pick(
            p.view,
            ["home", "items", "customers", "calendar", "report", "timeline"] as const,
            current.view,
          ),
          viewMode: pick(p.viewMode, ["list", "board"] as const, current.viewMode),
          boardDim: pick(p.boardDim, ["exec", "result", "report"] as const, current.boardDim),
          statusDim: pick(p.statusDim, ["exec", "result", "report"] as const, current.statusDim),
          calDateField: pick(
            p.calDateField,
            ["publishDate", "deadline", "finishedDate"] as const,
            current.calDateField,
          ),
          // restore the persisted mine-scope; other filters stay at their defaults
          filters: {
            ...current.filters,
            mine: typeof p.mine === "boolean" ? p.mine : current.filters.mine,
          },
          // restore the first-run flag so an emptied board isn't reseeded on reload
          initialized: typeof p.initialized === "boolean" ? p.initialized : current.initialized,
          // restore per-owner quotas; fall back to current ({}) when missing/malformed
          // so old persisted payloads without this key stay safe.
          ownerQuotas:
            p.ownerQuotas && typeof p.ownerQuotas === "object" ? p.ownerQuotas : current.ownerQuotas,
        };
      },
    },
  ),
);

function isStorageValue(value: unknown): value is StorageValue<Partial<Store>> {
  return Boolean(value && typeof value === "object" && "state" in value);
}

function normalizeImportStore(value: unknown) {
  if (!isImportStoreShape(value)) {
    throw new Error("โครงสร้างข้อมูลไม่ถูกต้อง");
  }

  return normalizeStore(value);
}

function isImportStoreShape(value: unknown): value is Partial<Store> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Store>;
  return Array.isArray(candidate.customers) && Array.isArray(candidate.items);
}

function toPersistedStore(state: Store): Store {
  return {
    version: STORE_VERSION,
    customers: state.customers,
    items: state.items,
    members: state.members,
    settings: state.settings,
  };
}

// Shared per-item transform for updateItem/updateItems — appends an activity
// entry, bumps updatedAt, auto-stamps reportSentDate, then re-normalizes.
function applyItemPatch(
  item: Item,
  patch: Partial<Item>,
  activityText: string,
  customerIds: Set<string>,
): Item {
  const activity = [...(item.activity || []), { ts: nowISO(), text: activityText }];
  const merged: Item = { ...item, ...patch, id: item.id, activity, updatedAt: nowISO() };
  // auto-stamp the report-sent date the first time a report is marked sent
  if (merged.reportStatus === "sent" && !merged.reportSentDate) {
    merged.reportSentDate = nowISO().slice(0, 10);
  }
  return normalizeItem(merged, customerIds);
}

function trimCustomerPatch(patch: Partial<Customer>) {
  return Object.fromEntries(
    Object.entries(patch).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : value,
    ]),
  ) as Partial<Customer>;
}
