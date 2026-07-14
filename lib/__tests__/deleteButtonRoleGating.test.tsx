import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomersView } from "@/components/CustomersView";
import { CustomerEditModal } from "@/components/CustomerEditModal";
import { ItemModal } from "@/components/ItemModal";
import { useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

// Regression coverage for the delete-button RLS bug: an ungated delete button
// let non-admin/manager roles fire a Supabase delete that RLS rejects, which
// then poisoned every later sync in the same batch (same bug class as the
// owner-quota input covered in reportView.test.tsx).
describe("delete buttons are gated by role in Supabase mode, unconditional in standalone mode", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  function enableSupabaseMode() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
  }

  afterEach(() => {
    cleanup();
    useStore.setState({
      customers: [],
      items: [],
      lastDeleted: null,
      modalItemId: null,
      isItemModalOpen: false,
      newItemPrefill: null,
    });
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  });

  function seedCustomer() {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้า A" });
    useStore.setState({ customers: [customer], items: [] });
    return customer;
  }

  function seedEditingItem() {
    const customer = makeCustomer({ id: "c1", name: "ลูกค้า A" });
    const item = makeItem({ id: "i1", customerId: "c1" });
    useStore.setState({
      customers: [customer],
      items: [item],
      modalItemId: "i1",
      isItemModalOpen: true,
      newItemPrefill: null,
    });
    return item;
  }

  describe("CustomersView (CustomerDetailPane) delete button", () => {
    it("is hidden for a role without customers.delete in Supabase mode", () => {
      enableSupabaseMode();
      const customer = seedCustomer();

      render(<CustomersView role="sale" />);
      fireEvent.click(screen.getByRole("option", { name: new RegExp(customer.name) }));

      expect(screen.queryByLabelText(`ลบลูกค้า ${customer.name}`)).toBeNull();
    });

    it("is visible for manager in Supabase mode", () => {
      enableSupabaseMode();
      const customer = seedCustomer();

      render(<CustomersView role="manager" />);
      fireEvent.click(screen.getByRole("option", { name: new RegExp(customer.name) }));

      expect(screen.getByLabelText(`ลบลูกค้า ${customer.name}`)).toBeTruthy();
    });

    it("is visible in standalone mode regardless of role", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      const customer = seedCustomer();

      render(<CustomersView role={null} />);
      fireEvent.click(screen.getByRole("option", { name: new RegExp(customer.name) }));

      expect(screen.getByLabelText(`ลบลูกค้า ${customer.name}`)).toBeTruthy();
    });
  });

  describe("CustomerEditModal delete button", () => {
    it("is hidden for a role without customers.delete in Supabase mode", () => {
      enableSupabaseMode();
      seedCustomer();

      render(<CustomerEditModal customerId="c1" onClose={() => {}} role="cs" />);

      expect(screen.queryByText("ลบลูกค้า")).toBeNull();
    });

    it("is visible for manager in Supabase mode", () => {
      enableSupabaseMode();
      seedCustomer();

      render(<CustomerEditModal customerId="c1" onClose={() => {}} role="manager" />);

      expect(screen.getByText("ลบลูกค้า")).toBeTruthy();
    });

    it("is visible in standalone mode regardless of role", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      seedCustomer();

      render(<CustomerEditModal customerId="c1" onClose={() => {}} role={null} />);

      expect(screen.getByText("ลบลูกค้า")).toBeTruthy();
    });
  });

  describe("ItemModal delete button", () => {
    it("is hidden for a role without items.delete in Supabase mode", () => {
      enableSupabaseMode();
      seedEditingItem();

      render(<ItemModal role="mkt" />);

      expect(screen.queryByRole("button", { name: "ลบ" })).toBeNull();
      // Scope discipline: duplicate stays available regardless of delete gating.
      expect(screen.getByRole("button", { name: "ทำซ้ำ" })).toBeTruthy();
    });

    it("is visible for manager in Supabase mode", () => {
      enableSupabaseMode();
      seedEditingItem();

      render(<ItemModal role="manager" />);

      expect(screen.getByRole("button", { name: "ลบ" })).toBeTruthy();
    });

    it("is visible in standalone mode regardless of role", () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      seedEditingItem();

      render(<ItemModal role={null} />);

      expect(screen.getByRole("button", { name: "ลบ" })).toBeTruthy();
    });
  });
});
