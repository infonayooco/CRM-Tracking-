import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SalesSummary } from "@/components/SalesSummary";
import { makeCustomer, makeItem } from "./factory";

// Each of the 4 breakdown cards (ประเภทงาน / ลูกค้า / ช่องทาง / เจ้าของงาน) owns its
// own sort control and must sort independently — switching one card's control
// must never reorder another card's rows.
describe("SalesSummary — per-section sort independence", () => {
  afterEach(cleanup);

  function sectionFor(headingText: string) {
    const heading = screen.getByText(headingText);
    const section = heading.closest("section");
    if (!section) throw new Error(`no <section> ancestor for heading "${headingText}"`);
    return section as HTMLElement;
  }

  it("changing the item-type card's sort direction does not reorder the customer or channel cards", () => {
    const customerA = makeCustomer({ id: "c1", name: "ลูกค้า A", salesOwner: "เจ้าของ A" });
    const customerB = makeCustomer({ id: "c2", name: "ลูกค้า B", salesOwner: "เจ้าของ B" });
    const items = [
      makeItem({ id: "i1", customerId: "c1", itemType: "ประเภท A", channel: "web", price: 1000 }),
      makeItem({ id: "i2", customerId: "c1", itemType: "ประเภท A", channel: "web", price: 1000 }),
      makeItem({ id: "i3", customerId: "c1", itemType: "ประเภท A", channel: "line", price: 1000 }),
      makeItem({ id: "i4", customerId: "c2", itemType: "ประเภท B", channel: "facebook", price: 5000 }),
    ];

    render(<SalesSummary items={items} customers={[customerA, customerB]} />);

    // Sanity: default sort (count desc) — "ประเภท A" (3 items) outranks "ประเภท B" (1).
    const itemTypeSection = sectionFor("จำนวนที่ขาย ตามประเภทงาน");
    expect(within(itemTypeSection).getAllByText(/^ประเภท [AB]$/).map((el) => el.textContent)).toEqual([
      "ประเภท A",
      "ประเภท B",
    ]);

    const customerSection = sectionFor("ลูกค้าตามจำนวนขาย");
    const channelSection = sectionFor("ช่องทาง");
    const customerOrderBefore = within(customerSection)
      .getAllByText(/^ลูกค้า [AB]$/)
      .map((el) => el.textContent);
    const channelOrderBefore = within(channelSection)
      .getAllByText(/^(Web|Facebook|LINE OA)$/)
      .map((el) => el.textContent);
    expect(customerOrderBefore).toEqual(["ลูกค้า A", "ลูกค้า B"]);

    // Flip ONLY the item-type card's direction to "น้อย → มาก".
    fireEvent.change(within(itemTypeSection).getByLabelText("ทิศทางการเรียงในส่วนประเภทงาน"), {
      target: { value: "asc" },
    });

    expect(within(itemTypeSection).getAllByText(/^ประเภท [AB]$/).map((el) => el.textContent)).toEqual([
      "ประเภท B",
      "ประเภท A",
    ]);

    // The other two cards must be completely unaffected.
    expect(
      within(customerSection)
        .getAllByText(/^ลูกค้า [AB]$/)
        .map((el) => el.textContent),
    ).toEqual(customerOrderBefore);
    expect(
      within(channelSection)
        .getAllByText(/^(Web|Facebook|LINE OA)$/)
        .map((el) => el.textContent),
    ).toEqual(channelOrderBefore);
  });

  it("the customer card sorts BEFORE its top-10 slice, so 'น้อย → มาก' surfaces the bottom-N rather than reversing the top-10", () => {
    const customers = Array.from({ length: 12 }, (_, index) =>
      makeCustomer({ id: `c${index + 1}`, name: `ลูกค้า ${String(index + 1).padStart(2, "0")}` }),
    );
    // Customer N gets exactly N items, so counts are 1..12 and every row is distinct.
    const items = customers.flatMap((customer, index) => {
      const count = index + 1;
      return Array.from({ length: count }, (_, itemIndex) =>
        makeItem({ id: `${customer.id}-${itemIndex}`, customerId: customer.id, price: 1000 }),
      );
    });

    render(<SalesSummary items={items} customers={customers} />);

    const customerSection = sectionFor("ลูกค้าตามจำนวนขาย");

    // Default (count desc, top 10) — the two smallest customers (01, 02; counts 1–2)
    // are cut by the slice; the largest (12) leads.
    expect(within(customerSection).queryByText("ลูกค้า 01")).toBeNull();
    expect(within(customerSection).queryByText("ลูกค้า 02")).toBeNull();
    expect(within(customerSection).getAllByText(/^ลูกค้า \d\d$/)[0].textContent).toBe("ลูกค้า 12");

    fireEvent.change(within(customerSection).getByLabelText("ทิศทางการเรียงในส่วนรายชื่อลูกค้า"), {
      target: { value: "asc" },
    });

    // If the slice ran before the sort, this asc view would just be the previous
    // top-10 (03–12) reversed — 01/02 would still be missing. Sorting first means
    // the bottom 10 (01–10) is what's sliced, so 01 must now be visible and first.
    expect(within(customerSection).getAllByText(/^ลูกค้า \d\d$/)[0].textContent).toBe("ลูกค้า 01");
    expect(within(customerSection).queryByText("ลูกค้า 11")).toBeNull();
    expect(within(customerSection).queryByText("ลูกค้า 12")).toBeNull();
  });
});
