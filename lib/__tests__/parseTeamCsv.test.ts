import { describe, expect, it } from "vitest";
import { parseTeamCsv } from "../parseTeamCsv";
import { SEED_CSV } from "../seedCsv";

describe("parseTeamCsv — seed parity", () => {
  const r = parseTeamCsv(SEED_CSV);

  it("yields 144 items and 34 customers", () => {
    expect(r.items.length).toBe(144);
    expect(r.customers.length).toBe(34);
  });

  it("ASA House QO-20260100007 has 9 items", () => {
    const asa = r.customers.find((c) => c.name.includes("ASA House"))!;
    expect(
      r.items.filter((it) => it.customerId === asa.id && it.qtNo === "QO-20260100007").length,
    ).toBe(9);
  });

  it("total revenue is 1,294,700", () => {
    expect(r.items.reduce((a, it) => a + (it.price || 0), 0)).toBe(1294700);
  });
});

describe("parseTeamCsv — forward-fill must NOT leak across groups (regression)", () => {
  const HEADER =
    "จังหวัด,ชื่อลูกค้า,เลขใบเสนอราคา (QT),เลขที่ใบวางบิล (INV),เจ้าของงานขาย ,ช่องทาง,รายการ,รายละเอียด,ราคา VAT7%,การดำเนินการ,สถานะ Ads,เป้าหมาย ที่ต้องการ,ผลลัพธ์ที่เกิดขึ้น,ผลลัพธ์,Link งาน,Deadline งานสื่อสารก่อนเผยแพร่,Publish Date,Finished Date,การจัดส่งรีพอร์ต,คะแนนการประเมิน";
  const csv = [
    ",,,,,,,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,,,,,",
    ",,,,,,,,,,,,,,,,,,,",
    HEADER,
    'ขอนแก่น,Customer A,QT1,IV1,พี่ไซน์,Web,Top Ads,,"1,000",เผยแพร่แล้ว,,,,,,,,,จัดส่งรีพอร์ตเรียบร้อย,',
    "ขอนแก่น,Customer B,QT2,,,Web,Top Ads,,\"2,000\",เผยแพร่แล้ว,,,,,,,,,,",
    "ขอนแก่น,Customer B,QT2,,,Web,บทความ,,0,เผยแพร่แล้ว,,,,,,,,,,",
  ].join("\n");
  const r = parseTeamCsv(csv);
  const b = r.customers.find((c) => c.name === "Customer B")!;

  it("Customer B salesOwner does NOT inherit พี่ไซน์", () => {
    expect(b.salesOwner).toBe("");
  });

  it('both Customer B items are not_sent (no leaked "sent")', () => {
    const items = r.items.filter((it) => it.customerId === b.id);
    expect(items.every((it) => it.reportStatus === "not_sent")).toBe(true);
  });
});
