// Supabase data-access for the CRM collections. Thin, typed wrappers over the
// tables; all mapping goes through lib/data/mappers.ts so app types never leak
// DB shapes and vice versa.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { Customer, Item } from "@/lib/types";
import { customerToRow, itemToRow, rowToCustomer, rowToItem } from "./mappers";

export type SupabaseDB = SupabaseClient<Database>;

export type CrmSnapshot = {
  customers: Customer[];
  items: Item[];
  members: string[];
  ownerQuotas: Record<string, number>;
};

export async function fetchSnapshot(db: SupabaseDB): Promise<CrmSnapshot> {
  const [customers, items, members, quotas] = await Promise.all([
    db.from("customers").select("*"),
    db.from("items").select("*"),
    db.from("members").select("name"),
    db.from("owner_quotas").select("owner, quota"),
  ]);
  for (const result of [customers, items, members, quotas]) {
    if (result.error) throw result.error;
  }
  return {
    customers: (customers.data ?? []).map(rowToCustomer),
    items: (items.data ?? []).map(rowToItem),
    members: (members.data ?? []).map((row) => row.name),
    ownerQuotas: Object.fromEntries((quotas.data ?? []).map((row) => [row.owner, Number(row.quota)])),
  };
}

export async function upsertCustomers(db: SupabaseDB, customers: Customer[]): Promise<void> {
  if (customers.length === 0) return;
  const { error } = await db.from("customers").upsert(customers.map(customerToRow));
  if (error) throw error;
}

export async function deleteCustomers(db: SupabaseDB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db.from("customers").delete().in("id", ids);
  if (error) throw error;
}

export async function upsertItems(db: SupabaseDB, items: Item[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await db.from("items").upsert(items.map(itemToRow));
  if (error) throw error;
}

export async function deleteItems(db: SupabaseDB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db.from("items").delete().in("id", ids);
  if (error) throw error;
}

export async function upsertMembers(db: SupabaseDB, names: string[]): Promise<void> {
  if (names.length === 0) return;
  const { error } = await db.from("members").upsert(names.map((name) => ({ name })));
  if (error) throw error;
}

export async function deleteMembers(db: SupabaseDB, names: string[]): Promise<void> {
  if (names.length === 0) return;
  const { error } = await db.from("members").delete().in("name", names);
  if (error) throw error;
}

export async function setOwnerQuotas(db: SupabaseDB, entries: [string, number][]): Promise<void> {
  if (entries.length === 0) return;
  const { error } = await db
    .from("owner_quotas")
    .upsert(entries.map(([owner, quota]) => ({ owner, quota })));
  if (error) throw error;
}

export async function deleteOwnerQuotas(db: SupabaseDB, owners: string[]): Promise<void> {
  if (owners.length === 0) return;
  const { error } = await db.from("owner_quotas").delete().in("owner", owners);
  if (error) throw error;
}
