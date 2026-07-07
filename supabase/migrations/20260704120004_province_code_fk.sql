-- ============================================================
-- Phase 2 of province normalization: province_code FK columns.
--
-- Expand-migrate step of an expand → migrate → contract rollout:
--   * customers.province_code  — backfilled from the existing free-text
--     customers.province (matched against provinces.name_th). The old
--     `province` text column is KEPT for now (contract/drop is a later phase),
--     so this migration is non-breaking and reversible.
--   * profiles.province_code   — NEW (profiles never had a province); starts
--     NULL and is set only by an admin (a later admin RPC), so it is NOT added
--     to the self-update column grant.
--
-- FK is ON DELETE RESTRICT: provinces are migration-managed reference data and
-- must never cascade-delete customers/profiles.
--
-- DEPLOY ORDERING: apply this migration BEFORE deploying the Phase 3 client
-- (which reads/writes province_code). The old `province` column stays populated
-- meanwhile, so the current client keeps working until Phase 3 ships.
--
-- TRANSITION NOTE (stale-on-edit): in the window between applying this and
-- deploying Phase 3, editing a customer's province TEXT does NOT update the
-- backfilled province_code (the current client omits the column), so the two can
-- diverge (e.g. text corrected but code left at the old province). Keep the
-- window short, and Phase 3 must write province_code from the picker AND
-- re-reconcile stale/NULL rows (a one-time re-run of the backfill below is safe:
-- it only fills still-NULL rows, so it will not clobber corrected codes).
--
-- Rollback (reverse order — this depends on 120003_provinces):
--   alter table public.customers drop constraint if exists customers_province_code_fkey;
--   alter table public.profiles  drop constraint if exists profiles_province_code_fkey;
--   alter table public.customers drop column if exists province_code;
--   alter table public.profiles  drop column if exists province_code;
-- ============================================================

-- 1. Columns (nullable — an unmatched/blank province leaves this NULL).
alter table public.customers add column if not exists province_code text;
alter table public.profiles  add column if not exists province_code text;

-- 2. Backfill customers from the existing Thai-name text. Idempotent: only fills
--    rows still NULL, and skips blank/whitespace-only province values. Rows whose
--    province text doesn't exactly match a provinces.name_th stay NULL (to be
--    fixed via the UI once the picker is code-based) rather than guessed.
update public.customers c
  set province_code = p.code
  from public.provinces p
  where c.province_code is null
    and btrim(c.province) <> ''
    and btrim(c.province) = p.name_th;

-- 3. FKs → provinces(code), RESTRICT so a province can't be deleted out from
--    under referencing rows (and never cascade-deletes customers/profiles).
alter table public.customers drop constraint if exists customers_province_code_fkey;
alter table public.customers
  add constraint customers_province_code_fkey
  foreign key (province_code) references public.provinces (code) on delete restrict;

alter table public.profiles drop constraint if exists profiles_province_code_fkey;
alter table public.profiles
  add constraint profiles_province_code_fkey
  foreign key (province_code) references public.provinces (code) on delete restrict;

-- 4. Index the customers FK for province-scoped filtering (mirrors the existing
--    customers_sales_owner_idx pattern).
create index if not exists customers_province_code_idx on public.customers (province_code);

comment on column public.customers.province_code is
  'ISO 3166-2:TH province code (FK provinces.code). Supersedes the legacy free-text province column (kept during migration).';
comment on column public.profiles.province_code is
  'ISO 3166-2:TH province code (FK provinces.code) — the member''s province scope; admin-managed.';
