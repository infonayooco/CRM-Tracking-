import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportView } from "@/components/ReportView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

function seedOwnerPerformanceData() {
  const customerA = makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "พี่ไซน์" });
  const customerB = makeCustomer({ id: "c2", name: "ลูกค้า B", salesOwner: "พี่บอส" });
  useStore.setState({
    customers: [customerA, customerB],
    items: [
      makeItem({
        id: "a",
        customerId: customerA.id,
        channel: "web",
        price: 15000,
        execStatus: "done",
        resultStatus: "achieved",
        reportStatus: "sent",
        renewalStatus: "renewed",
      }),
      makeItem({
        id: "b",
        customerId: customerB.id,
        channel: "facebook",
        price: 8000,
        execStatus: "in_progress",
        resultStatus: "not_collected",
        reportStatus: "not_sent",
        renewalStatus: "pending",
      }),
    ],
    members: [customerA.salesOwner, customerB.salesOwner],
    settings: { currentUser: customerA.salesOwner },
    filters: { ...defaultFilters, mine: false },
    view: "report",
  });
}

describe("ReportView — overview tab renders grouped, collapsible sections without crashing", () => {
  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], lastDeleted: null });
  });

  it("renders the section headings and a known panel heading", () => {
    const customerA = makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "พี่ไซน์" });
    const customerB = makeCustomer({ id: "c2", name: "ลูกค้า B", salesOwner: "พี่บอส" });
    useStore.setState({
      customers: [customerA, customerB],
      items: [
        makeItem({
          id: "a",
          customerId: customerA.id,
          channel: "web",
          price: 15000,
          execStatus: "done",
          resultStatus: "achieved",
          reportStatus: "sent",
          renewalStatus: "renewed",
        }),
        makeItem({
          id: "b",
          customerId: customerB.id,
          channel: "facebook",
          price: 8000,
          execStatus: "in_progress",
          resultStatus: "not_collected",
          reportStatus: "not_sent",
          renewalStatus: "pending",
        }),
      ],
      members: [customerA.salesOwner, customerB.salesOwner],
      settings: { currentUser: customerA.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "report",
    });

    expect(() => render(<ReportView role={null} />)).not.toThrow();

    expect(screen.getByText("การเงิน & รายได้")).toBeTruthy();
    expect(screen.getByText("ประสิทธิภาพงาน")).toBeTruthy();
    expect(screen.getByText("ประสิทธิภาพตามช่องทาง")).toBeTruthy();
  });

  // Guards the mobile-card reflow (.responsive-table): each <td data-label> is
  // what a phone shows as that cell's column name, so it must stay identical to
  // the desktop <th> header text. A layout engine isn't needed to catch drift —
  // just that every data-label maps to a real header in the same table, and that
  // only the first (title) cell of each row is unlabelled.
  it("keeps every mobile data-label in sync with its table header", () => {
    const customerA = makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "พี่ไซน์" });
    const customerB = makeCustomer({ id: "c2", name: "ลูกค้า B", salesOwner: "พี่บอส" });
    useStore.setState({
      customers: [customerA, customerB],
      items: [
        makeItem({
          id: "a",
          customerId: customerA.id,
          channel: "web",
          qtNo: "QT-1",
          price: 15000,
          execStatus: "done",
          resultStatus: "achieved",
          reportStatus: "sent",
          renewalStatus: "renewed",
          metricName: "ยอดวิว",
          metricUnit: "ครั้ง",
          targetValue: 1000,
          actualValue: 1200,
        }),
        makeItem({
          id: "b",
          customerId: customerB.id,
          channel: "facebook",
          qtNo: "QT-2",
          price: 8000,
          execStatus: "in_progress",
          resultStatus: "not_collected",
          reportStatus: "not_sent",
          renewalStatus: "pending",
        }),
      ],
      members: [customerA.salesOwner, customerB.salesOwner],
      settings: { currentUser: customerA.salesOwner },
      filters: { ...defaultFilters, mine: false },
      view: "report",
    });

    const { container } = render(<ReportView role={null} />);
    const tables = Array.from(container.querySelectorAll("table.responsive-table"));
    // Channel + owner + itemType + customer-health at minimum render with this data.
    expect(tables.length).toBeGreaterThanOrEqual(3);

    for (const table of tables) {
      const headers = new Set(
        Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent?.trim() ?? ""),
      );
      expect(headers.size).toBeGreaterThan(0);

      for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
        const cells = Array.from(row.querySelectorAll("td"));
        // first cell is the row's title card-header → intentionally unlabelled
        expect(cells[0].hasAttribute("data-label")).toBe(false);
        for (const cell of cells.slice(1)) {
          const label = cell.getAttribute("data-label");
          expect(label).toBeTruthy();
          expect(headers.has(label!)).toBe(true);
        }
      }
    }
  });
});

// Regression coverage for the owner-quota RLS bug: an ungated quota <input>
// let non-manager roles write to owner_quotas, which Postgres rejects and
// which then poisoned every later Supabase sync in the same batch.
describe("ReportView — owner quota input is gated by role in Supabase mode", () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  afterEach(() => {
    cleanup();
    useStore.setState({ items: [], customers: [], lastDeleted: null });
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = key;
  });

  function enableSupabaseMode() {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_x";
  }

  it("renders the quota as read-only text for a role without team.manage in Supabase mode", () => {
    enableSupabaseMode();
    seedOwnerPerformanceData();

    render(<ReportView role="sale" />);

    expect(screen.queryByLabelText("เป้าหมายรายได้ต่อเดือนของ พี่ไซน์")?.tagName).not.toBe("INPUT");
    expect(screen.getAllByLabelText(/เป้าหมายรายได้ต่อเดือนของ/).every((el) => el.tagName !== "INPUT")).toBe(true);
  });

  it("keeps the quota input editable for a role with team.manage in Supabase mode", () => {
    enableSupabaseMode();
    seedOwnerPerformanceData();

    render(<ReportView role="manager" />);

    expect(screen.getAllByLabelText(/เป้าหมายรายได้ต่อเดือนของ/).every((el) => el.tagName === "INPUT")).toBe(true);
  });

  it("keeps the quota input editable in standalone mode regardless of role", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    seedOwnerPerformanceData();

    render(<ReportView role={null} />);

    expect(screen.getAllByLabelText(/เป้าหมายรายได้ต่อเดือนของ/).every((el) => el.tagName === "INPUT")).toBe(true);
  });
});
