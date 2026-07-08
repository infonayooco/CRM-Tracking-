import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ReportView } from "@/components/ReportView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

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

    expect(() => render(<ReportView />)).not.toThrow();

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

    const { container } = render(<ReportView />);
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
