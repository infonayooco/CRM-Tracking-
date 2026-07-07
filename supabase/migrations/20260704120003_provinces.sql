-- ============================================================
-- Province reference table (ISO 3166-2:TH).
--
-- Single source of truth for Thailand's 77 provinces. customers.province and
-- profiles.province move from free-text Thai names to a province_code FK to this
-- table (a later migration) for referential integrity and rename-safety.
--
-- Seeded here and treated as read-only via the Data API (managed by migration).
-- Rollback: drop table public.provinces cascade;
-- ============================================================

create table if not exists public.provinces (
  code    text primary key,          -- ISO 3166-2:TH, e.g. 'TH-40'
  name_th text not null,
  name_en text not null,
  constraint provinces_code_format check (code ~ '^TH-[0-9]{2}$')
);

comment on table public.provinces is
  'Thailand provinces (ISO 3166-2:TH). Seeded by migration; read-only via the Data API.';

-- Idempotent seed — safe to re-apply (updates names on conflict, never dropping rows).
insert into public.provinces (code, name_th, name_en) values
  ('TH-10', 'กรุงเทพมหานคร', 'Bangkok'),
  ('TH-11', 'สมุทรปราการ', 'Samut Prakan'),
  ('TH-12', 'นนทบุรี', 'Nonthaburi'),
  ('TH-13', 'ปทุมธานี', 'Pathum Thani'),
  ('TH-14', 'พระนครศรีอยุธยา', 'Phra Nakhon Si Ayutthaya'),
  ('TH-15', 'อ่างทอง', 'Ang Thong'),
  ('TH-16', 'ลพบุรี', 'Lop Buri'),
  ('TH-17', 'สิงห์บุรี', 'Sing Buri'),
  ('TH-18', 'ชัยนาท', 'Chai Nat'),
  ('TH-19', 'สระบุรี', 'Saraburi'),
  ('TH-20', 'ชลบุรี', 'Chon Buri'),
  ('TH-21', 'ระยอง', 'Rayong'),
  ('TH-22', 'จันทบุรี', 'Chanthaburi'),
  ('TH-23', 'ตราด', 'Trat'),
  ('TH-24', 'ฉะเชิงเทรา', 'Chachoengsao'),
  ('TH-25', 'ปราจีนบุรี', 'Prachin Buri'),
  ('TH-26', 'นครนายก', 'Nakhon Nayok'),
  ('TH-27', 'สระแก้ว', 'Sa Kaeo'),
  ('TH-30', 'นครราชสีมา', 'Nakhon Ratchasima'),
  ('TH-31', 'บุรีรัมย์', 'Buri Ram'),
  ('TH-32', 'สุรินทร์', 'Surin'),
  ('TH-33', 'ศรีสะเกษ', 'Si Sa Ket'),
  ('TH-34', 'อุบลราชธานี', 'Ubon Ratchathani'),
  ('TH-35', 'ยโสธร', 'Yasothon'),
  ('TH-36', 'ชัยภูมิ', 'Chaiyaphum'),
  ('TH-37', 'อำนาจเจริญ', 'Amnat Charoen'),
  ('TH-38', 'บึงกาฬ', 'Bueng Kan'),
  ('TH-39', 'หนองบัวลำภู', 'Nong Bua Lam Phu'),
  ('TH-40', 'ขอนแก่น', 'Khon Kaen'),
  ('TH-41', 'อุดรธานี', 'Udon Thani'),
  ('TH-42', 'เลย', 'Loei'),
  ('TH-43', 'หนองคาย', 'Nong Khai'),
  ('TH-44', 'มหาสารคาม', 'Maha Sarakham'),
  ('TH-45', 'ร้อยเอ็ด', 'Roi Et'),
  ('TH-46', 'กาฬสินธุ์', 'Kalasin'),
  ('TH-47', 'สกลนคร', 'Sakon Nakhon'),
  ('TH-48', 'นครพนม', 'Nakhon Phanom'),
  ('TH-49', 'มุกดาหาร', 'Mukdahan'),
  ('TH-50', 'เชียงใหม่', 'Chiang Mai'),
  ('TH-51', 'ลำพูน', 'Lamphun'),
  ('TH-52', 'ลำปาง', 'Lampang'),
  ('TH-53', 'อุตรดิตถ์', 'Uttaradit'),
  ('TH-54', 'แพร่', 'Phrae'),
  ('TH-55', 'น่าน', 'Nan'),
  ('TH-56', 'พะเยา', 'Phayao'),
  ('TH-57', 'เชียงราย', 'Chiang Rai'),
  ('TH-58', 'แม่ฮ่องสอน', 'Mae Hong Son'),
  ('TH-60', 'นครสวรรค์', 'Nakhon Sawan'),
  ('TH-61', 'อุทัยธานี', 'Uthai Thani'),
  ('TH-62', 'กำแพงเพชร', 'Kamphaeng Phet'),
  ('TH-63', 'ตาก', 'Tak'),
  ('TH-64', 'สุโขทัย', 'Sukhothai'),
  ('TH-65', 'พิษณุโลก', 'Phitsanulok'),
  ('TH-66', 'พิจิตร', 'Phichit'),
  ('TH-67', 'เพชรบูรณ์', 'Phetchabun'),
  ('TH-70', 'ราชบุรี', 'Ratchaburi'),
  ('TH-71', 'กาญจนบุรี', 'Kanchanaburi'),
  ('TH-72', 'สุพรรณบุรี', 'Suphan Buri'),
  ('TH-73', 'นครปฐม', 'Nakhon Pathom'),
  ('TH-74', 'สมุทรสาคร', 'Samut Sakhon'),
  ('TH-75', 'สมุทรสงคราม', 'Samut Songkhram'),
  ('TH-76', 'เพชรบุรี', 'Phetchaburi'),
  ('TH-77', 'ประจวบคีรีขันธ์', 'Prachuap Khiri Khan'),
  ('TH-80', 'นครศรีธรรมราช', 'Nakhon Si Thammarat'),
  ('TH-81', 'กระบี่', 'Krabi'),
  ('TH-82', 'พังงา', 'Phang Nga'),
  ('TH-83', 'ภูเก็ต', 'Phuket'),
  ('TH-84', 'สุราษฎร์ธานี', 'Surat Thani'),
  ('TH-85', 'ระนอง', 'Ranong'),
  ('TH-86', 'ชุมพร', 'Chumphon'),
  ('TH-90', 'สงขลา', 'Songkhla'),
  ('TH-91', 'สตูล', 'Satun'),
  ('TH-92', 'ตรัง', 'Trang'),
  ('TH-93', 'พัทลุง', 'Phatthalung'),
  ('TH-94', 'ปัตตานี', 'Pattani'),
  ('TH-95', 'ยะลา', 'Yala'),
  ('TH-96', 'นราธิวาส', 'Narathiwat')
on conflict (code) do update
  set name_th = excluded.name_th,
      name_en = excluded.name_en;

-- RLS: the province list is public reference data — any authenticated user may
-- read it (to populate pickers / resolve names). No write grants: the table is
-- maintained only through migrations.
alter table public.provinces enable row level security;

drop policy if exists "Provinces are readable by authenticated users" on public.provinces;
create policy "Provinces are readable by authenticated users"
  on public.provinces for select
  to authenticated
  using (true);

-- New Supabase projects revoke Data-API access to new tables by default
-- (default flipped 2026-05-30) — grant read only.
grant select on public.provinces to authenticated;
