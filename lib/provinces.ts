// Canonical reference list of Thailand's 77 provinces, keyed by the stable
// ISO 3166-2:TH code (e.g. "TH-40" = ขอนแก่น). This is the single source of
// truth for the client; the `provinces` DB table (supabase/migrations) is seeded
// to match. Storing province as a code (FK) rather than a free-text Thai name
// gives referential integrity and rename-safety, while the code→name maps below
// keep display join-free (the client already loads all data into the store).
//
// provinces.test.ts enforces: exactly 77 rows, unique codes, unique Thai names,
// and the TH-\d\d code format.
export interface Province {
  /** ISO 3166-2:TH code, e.g. "TH-40". */
  code: string;
  /** Thai name. */
  th: string;
  /** English name. */
  en: string;
}

export const PROVINCES: readonly Province[] = [
  // ภาคกลาง (Central)
  { code: "TH-10", th: "กรุงเทพมหานคร", en: "Bangkok" },
  { code: "TH-11", th: "สมุทรปราการ", en: "Samut Prakan" },
  { code: "TH-12", th: "นนทบุรี", en: "Nonthaburi" },
  { code: "TH-13", th: "ปทุมธานี", en: "Pathum Thani" },
  { code: "TH-14", th: "พระนครศรีอยุธยา", en: "Phra Nakhon Si Ayutthaya" },
  { code: "TH-15", th: "อ่างทอง", en: "Ang Thong" },
  { code: "TH-16", th: "ลพบุรี", en: "Lop Buri" },
  { code: "TH-17", th: "สิงห์บุรี", en: "Sing Buri" },
  { code: "TH-18", th: "ชัยนาท", en: "Chai Nat" },
  { code: "TH-19", th: "สระบุรี", en: "Saraburi" },
  { code: "TH-60", th: "นครสวรรค์", en: "Nakhon Sawan" },
  { code: "TH-61", th: "อุทัยธานี", en: "Uthai Thani" },
  { code: "TH-62", th: "กำแพงเพชร", en: "Kamphaeng Phet" },
  { code: "TH-64", th: "สุโขทัย", en: "Sukhothai" },
  { code: "TH-65", th: "พิษณุโลก", en: "Phitsanulok" },
  { code: "TH-66", th: "พิจิตร", en: "Phichit" },
  { code: "TH-67", th: "เพชรบูรณ์", en: "Phetchabun" },
  { code: "TH-70", th: "ราชบุรี", en: "Ratchaburi" },
  { code: "TH-71", th: "กาญจนบุรี", en: "Kanchanaburi" },
  { code: "TH-72", th: "สุพรรณบุรี", en: "Suphan Buri" },
  { code: "TH-73", th: "นครปฐม", en: "Nakhon Pathom" },
  { code: "TH-74", th: "สมุทรสาคร", en: "Samut Sakhon" },
  { code: "TH-75", th: "สมุทรสงคราม", en: "Samut Songkhram" },
  { code: "TH-76", th: "เพชรบุรี", en: "Phetchaburi" },
  { code: "TH-77", th: "ประจวบคีรีขันธ์", en: "Prachuap Khiri Khan" },
  // ภาคตะวันออก (East)
  { code: "TH-20", th: "ชลบุรี", en: "Chon Buri" },
  { code: "TH-21", th: "ระยอง", en: "Rayong" },
  { code: "TH-22", th: "จันทบุรี", en: "Chanthaburi" },
  { code: "TH-23", th: "ตราด", en: "Trat" },
  { code: "TH-24", th: "ฉะเชิงเทรา", en: "Chachoengsao" },
  { code: "TH-25", th: "ปราจีนบุรี", en: "Prachin Buri" },
  { code: "TH-26", th: "นครนายก", en: "Nakhon Nayok" },
  { code: "TH-27", th: "สระแก้ว", en: "Sa Kaeo" },
  // ภาคตะวันออกเฉียงเหนือ (Northeast / Isan)
  { code: "TH-30", th: "นครราชสีมา", en: "Nakhon Ratchasima" },
  { code: "TH-31", th: "บุรีรัมย์", en: "Buri Ram" },
  { code: "TH-32", th: "สุรินทร์", en: "Surin" },
  { code: "TH-33", th: "ศรีสะเกษ", en: "Si Sa Ket" },
  { code: "TH-34", th: "อุบลราชธานี", en: "Ubon Ratchathani" },
  { code: "TH-35", th: "ยโสธร", en: "Yasothon" },
  { code: "TH-36", th: "ชัยภูมิ", en: "Chaiyaphum" },
  { code: "TH-37", th: "อำนาจเจริญ", en: "Amnat Charoen" },
  { code: "TH-38", th: "บึงกาฬ", en: "Bueng Kan" },
  { code: "TH-39", th: "หนองบัวลำภู", en: "Nong Bua Lam Phu" },
  { code: "TH-40", th: "ขอนแก่น", en: "Khon Kaen" },
  { code: "TH-41", th: "อุดรธานี", en: "Udon Thani" },
  { code: "TH-42", th: "เลย", en: "Loei" },
  { code: "TH-43", th: "หนองคาย", en: "Nong Khai" },
  { code: "TH-44", th: "มหาสารคาม", en: "Maha Sarakham" },
  { code: "TH-45", th: "ร้อยเอ็ด", en: "Roi Et" },
  { code: "TH-46", th: "กาฬสินธุ์", en: "Kalasin" },
  { code: "TH-47", th: "สกลนคร", en: "Sakon Nakhon" },
  { code: "TH-48", th: "นครพนม", en: "Nakhon Phanom" },
  { code: "TH-49", th: "มุกดาหาร", en: "Mukdahan" },
  // ภาคเหนือ (North)
  { code: "TH-50", th: "เชียงใหม่", en: "Chiang Mai" },
  { code: "TH-51", th: "ลำพูน", en: "Lamphun" },
  { code: "TH-52", th: "ลำปาง", en: "Lampang" },
  { code: "TH-53", th: "อุตรดิตถ์", en: "Uttaradit" },
  { code: "TH-54", th: "แพร่", en: "Phrae" },
  { code: "TH-55", th: "น่าน", en: "Nan" },
  { code: "TH-56", th: "พะเยา", en: "Phayao" },
  { code: "TH-57", th: "เชียงราย", en: "Chiang Rai" },
  { code: "TH-58", th: "แม่ฮ่องสอน", en: "Mae Hong Son" },
  { code: "TH-63", th: "ตาก", en: "Tak" },
  // ภาคใต้ (South)
  { code: "TH-80", th: "นครศรีธรรมราช", en: "Nakhon Si Thammarat" },
  { code: "TH-81", th: "กระบี่", en: "Krabi" },
  { code: "TH-82", th: "พังงา", en: "Phang Nga" },
  { code: "TH-83", th: "ภูเก็ต", en: "Phuket" },
  { code: "TH-84", th: "สุราษฎร์ธานี", en: "Surat Thani" },
  { code: "TH-85", th: "ระนอง", en: "Ranong" },
  { code: "TH-86", th: "ชุมพร", en: "Chumphon" },
  { code: "TH-90", th: "สงขลา", en: "Songkhla" },
  { code: "TH-91", th: "สตูล", en: "Satun" },
  { code: "TH-92", th: "ตรัง", en: "Trang" },
  { code: "TH-93", th: "พัทลุง", en: "Phatthalung" },
  { code: "TH-94", th: "ปัตตานี", en: "Pattani" },
  { code: "TH-95", th: "ยะลา", en: "Yala" },
  { code: "TH-96", th: "นราธิวาส", en: "Narathiwat" },
];

// code → province, for resolving a stored province_code to its display name.
export const PROVINCE_BY_CODE: Record<string, Province> = Object.fromEntries(
  PROVINCES.map((province) => [province.code, province]),
);

// Thai name → code, used to backfill legacy free-text `province` values (the old
// customers.province text column) into province_code during migration.
export const PROVINCE_CODE_BY_TH: Record<string, string> = Object.fromEntries(
  PROVINCES.map((province) => [province.th, province.code]),
);

// Provinces pre-sorted by Thai name for display in pickers.
export const PROVINCES_SORTED_TH: readonly Province[] = [...PROVINCES].sort((a, b) =>
  a.th.localeCompare(b.th, "th"),
);

/** Display Thai name for a stored province_code (empty string if unset/unknown). */
export function provinceNameTh(code: string | null | undefined): string {
  if (!code) return "";
  return PROVINCE_BY_CODE[code]?.th ?? "";
}
