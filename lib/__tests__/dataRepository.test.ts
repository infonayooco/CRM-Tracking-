import { describe, expect, it } from "vitest";
import {
  type SupabaseDB,
  deleteItems,
  fetchSnapshot,
  upsertCustomers,
} from "@/lib/data/repository";
import { normalizeCustomer } from "@/lib/normalize";

type Call = { op: string; table: string; [key: string]: unknown };

// Minimal fake of the supabase-js query builder covering just the calls the
// repository makes: from().select(), from().upsert(), from().delete().in().
function fakeDb(tableData: Record<string, { data?: unknown; error?: unknown }> = {}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      return {
        select(cols: string) {
          calls.push({ op: "select", table, cols });
          return Promise.resolve(tableData[table] ?? { data: [], error: null });
        },
        upsert(rows: unknown) {
          calls.push({ op: "upsert", table, rows });
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            in(col: string, ids: string[]) {
              calls.push({ op: "delete", table, col, ids });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
  };
  return { db: db as unknown as SupabaseDB, calls };
}

describe("repository", () => {
  it("fetchSnapshot maps DB rows to app types", async () => {
    const { db } = fakeDb({
      customers: {
        data: [
          {
            id: "c1",
            name: "ลูกค้า",
            province: "",
            sales_owner: "",
            contact_person: "",
            phone: "",
            email: "",
            line_id: "",
            color: "#2563eb",
            interactions: [],
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        error: null,
      },
      items: { data: [], error: null },
      members: { data: [{ name: "X" }], error: null },
      owner_quotas: { data: [{ owner: "X", quota: 1000 }], error: null },
    });
    const snap = await fetchSnapshot(db);
    expect(snap.customers[0].id).toBe("c1");
    expect(snap.members).toEqual(["X"]);
    expect(snap.ownerQuotas).toEqual({ X: 1000 });
  });

  it("fetchSnapshot throws if any query errors", async () => {
    const { db } = fakeDb({ customers: { data: null, error: { message: "boom" } } });
    await expect(fetchSnapshot(db)).rejects.toBeTruthy();
  });

  it("upsertCustomers is a no-op when empty and maps to snake_case rows otherwise", async () => {
    const { db, calls } = fakeDb();
    await upsertCustomers(db, []);
    expect(calls).toHaveLength(0);

    await upsertCustomers(db, [normalizeCustomer({ id: "c1", name: "A", salesOwner: "พี่ก้อย" })]);
    const call = calls.find((c) => c.op === "upsert");
    expect(call?.table).toBe("customers");
    expect((call?.rows as Array<{ id: string; sales_owner: string }>)[0]).toMatchObject({
      id: "c1",
      sales_owner: "พี่ก้อย",
    });
  });

  it("deleteItems issues delete().in(id, ids)", async () => {
    const { db, calls } = fakeDb();
    await deleteItems(db, ["i1", "i2"]);
    expect(calls[0]).toMatchObject({ op: "delete", table: "items", col: "id", ids: ["i1", "i2"] });
  });
});
