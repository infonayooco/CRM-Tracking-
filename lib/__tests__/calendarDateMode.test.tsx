import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarView } from "@/components/CalendarView";
import { defaultFilters, useStore } from "@/lib/store";
import { makeCustomer, makeItem } from "./factory";

function reset() {
  useStore.setState({
    customers: [],
    items: [],
    members: [],
    filters: defaultFilters,
    calDateField: "publishDate",
  });
}

// Feature: the calendar date selector gains an "ทั้งหมด" (all date types) mode
// and opens on it by default.
describe("CalendarView — 'ทั้งหมด' date mode", () => {
  afterEach(() => {
    cleanup();
    reset();
  });

  it("defaults the date-mode selector to ทั้งหมด on entry", () => {
    reset();
    render(<CalendarView />);
    const group = within(screen.getByRole("group", { name: "วันที่ที่ใช้ใน Calendar" }));
    expect(group.getByRole("button", { name: "ทุกวันที่" }).getAttribute("aria-pressed")).toBe("true");
    expect(group.getByRole("button", { name: "Publish Date" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("switches the active date mode when a specific field is clicked", () => {
    reset();
    render(<CalendarView />);
    const group = within(screen.getByRole("group", { name: "วันที่ที่ใช้ใน Calendar" }));
    fireEvent.click(group.getByRole("button", { name: "Deadline" }));
    expect(group.getByRole("button", { name: "Deadline" }).getAttribute("aria-pressed")).toBe("true");
    expect(group.getByRole("button", { name: "ทุกวันที่" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("in ทั้งหมด mode, an item with none of the three dates falls into the 'ไม่มีวันที่' list", () => {
    useStore.setState({
      customers: [makeCustomer({ id: "c1", name: "ลูกค้า" })],
      items: [
        makeItem({
          id: "i1",
          customerId: "c1",
          itemType: "งานไร้วันที่",
          publishDate: "",
          deadline: "",
          finishedDate: "",
        }),
      ],
      members: ["พี่ไซน์"],
      filters: defaultFilters,
      calDateField: "publishDate",
    });
    render(<CalendarView />);
    expect(screen.getByText("งานไร้วันที่")).toBeTruthy();
  });
});
