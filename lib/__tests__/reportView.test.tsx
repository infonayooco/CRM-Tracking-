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
});
