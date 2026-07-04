-- ============================================================
-- CRM core tables — a faithful port of lib/types.ts.
--
-- Team-shared access model: every authenticated user can read/write
-- all rows (no per-row ownership). salesOwner stays a free-text field,
-- matching the current app. Embedded arrays (interactions, checklist,
-- activity) are kept as JSONB for a lossless round-trip with the store.
-- ============================================================

-- Roster of sales owners (mirrors Store.members).
create table if not exists public.members (
  name       text primary key,
  created_at timestamptz not null default now()
);

-- Per-owner monthly revenue quota (mirrors the ownerQuotas map that
-- lib/store.ts persists; note it lives on the store state, not the Store type).
create table if not exists public.owner_quotas (
  owner text primary key,
  quota numeric not null default 0
);

-- Customers (lib/types.ts Customer).
create table if not exists public.customers (
  id             text primary key,
  name           text not null,
  province       text not null default '',
  sales_owner    text not null default '',
  contact_person text not null default '',
  phone          text not null default '',
  email          text not null default '',
  line_id        text not null default '',
  color          text not null default '#2563eb',
  interactions   jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

-- Items (lib/types.ts Item). Enumerated fields use CHECK constraints
-- (easier to evolve than pg enum types). Date-only fields are real `date`
-- columns; the app's "" empty-string convention maps to NULL via the mapper.
-- The same "" -> NULL rule applies to customer_id: an orphan item has
-- customerId "" in the app, which must become NULL (not '') on write, since
-- the FK has no customers row with id = ''.
create table if not exists public.items (
  id              text primary key,
  customer_id     text references public.customers (id) on delete cascade,
  qt_no           text not null default '',
  inv_no          text not null default '',
  channel         text not null default 'other'
                    check (channel in ('facebook','web','google','line','tiktok','youtube','other')),
  item_type       text not null default '(ไม่ระบุรายการ)',
  detail          text not null default '',
  price           numeric,
  exec_status     text not null default 'not_started'
                    check (exec_status in ('not_started','in_progress','published','done')),
  result_status   text not null default 'not_collected'
                    check (result_status in ('not_collected','in_progress','achieved')),
  report_status   text not null default 'not_sent'
                    check (report_status in ('not_sent','sent')),
  renewal_status  text not null default 'pending'
                    check (renewal_status in ('pending','renewed','lost')),
  target          text not null default '',
  actual          text not null default '',
  metric_name     text not null default '',
  metric_unit     text not null default '',
  target_value    numeric,
  actual_value    numeric,
  report_sent_date date,
  link            text not null default '',
  rating          integer not null default 0 check (rating between 0 and 5),
  deadline        date,
  publish_date    date,
  finished_date   date,
  notes           text not null default '',
  follow_up_date  date,
  follow_up_note  text not null default '',
  priority        text not null default 'medium' check (priority in ('high','medium','low')),
  progress        integer not null default 0 check (progress between 0 and 100),
  checklist       jsonb not null default '[]'::jsonb,
  activity        jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  -- updated_at is owned by the app (it stamps updatedAt on every mutation),
  -- so there is deliberately NO db trigger overwriting it here.
  updated_at      timestamptz not null default now()
);

-- Indexes for the app's common access patterns (board grouping by customer,
-- calendar/gantt by date, follow-up queue, owner filters).
create index if not exists items_customer_id_idx    on public.items (customer_id);
create index if not exists items_qt_no_idx           on public.items (qt_no);
create index if not exists items_deadline_idx        on public.items (deadline);
create index if not exists items_publish_date_idx    on public.items (publish_date);
create index if not exists items_follow_up_date_idx  on public.items (follow_up_date);
create index if not exists customers_sales_owner_idx on public.customers (sales_owner);

-- ------------------------------------------------------------
-- Role-based RLS (capability model). Everyone with ANY assigned role can READ
-- all data; write/delete capability differs by role; a NULL-role ("pending")
-- user can do nothing. public.user_role() is SECURITY DEFINER (migration 1) so
-- these policies don't recurse into profiles' RLS.
--
-- Capability matrix (delete restricted to admin/manager to protect data;
-- "sale deletes own" deferred until profiles.sales_owner is linked in a later
-- phase). Refine any predicate here without touching app code.
-- ------------------------------------------------------------
alter table public.members      enable row level security;
alter table public.owner_quotas enable row level security;
alter table public.customers    enable row level security;
alter table public.items        enable row level security;

-- customers: read = any role; insert = admin/manager/sale; update also cs
-- (contact + interactions); delete = admin/manager.
drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers for select to authenticated
  using (public.user_role(auth.uid()) is not null);
drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert" on public.customers for insert to authenticated
  with check (public.user_role(auth.uid()) in ('admin','manager','sale'));
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers for update to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager','sale','cs'))
  with check (public.user_role(auth.uid()) in ('admin','manager','sale','cs'));
drop policy if exists "customers_delete" on public.customers;
create policy "customers_delete" on public.customers for delete to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'));

-- items: read = any role; insert = admin/manager/sale/mkt; update also cs
-- (follow-up + report status); delete = admin/manager.
drop policy if exists "items_select" on public.items;
create policy "items_select" on public.items for select to authenticated
  using (public.user_role(auth.uid()) is not null);
drop policy if exists "items_insert" on public.items;
create policy "items_insert" on public.items for insert to authenticated
  with check (public.user_role(auth.uid()) in ('admin','manager','sale','mkt'));
drop policy if exists "items_update" on public.items;
create policy "items_update" on public.items for update to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager','sale','mkt','cs'))
  with check (public.user_role(auth.uid()) in ('admin','manager','sale','mkt','cs'));
drop policy if exists "items_delete" on public.items;
create policy "items_delete" on public.items for delete to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'));

-- members + owner_quotas (management data): read = any role; write = admin/manager.
drop policy if exists "members_select" on public.members;
create policy "members_select" on public.members for select to authenticated
  using (public.user_role(auth.uid()) is not null);
drop policy if exists "members_write" on public.members;
create policy "members_write" on public.members for all to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'))
  with check (public.user_role(auth.uid()) in ('admin','manager'));

drop policy if exists "owner_quotas_select" on public.owner_quotas;
create policy "owner_quotas_select" on public.owner_quotas for select to authenticated
  using (public.user_role(auth.uid()) is not null);
drop policy if exists "owner_quotas_write" on public.owner_quotas;
create policy "owner_quotas_write" on public.owner_quotas for all to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'))
  with check (public.user_role(auth.uid()) in ('admin','manager'));

-- Explicit Data-API grants (new tables are revoked by default). Logged-out
-- (anon) users get no grant and no policy, so all data is private.
grant select, insert, update, delete on public.members      to authenticated;
grant select, insert, update, delete on public.owner_quotas to authenticated;
grant select, insert, update, delete on public.customers    to authenticated;
grant select, insert, update, delete on public.items        to authenticated;

-- Realtime: broadcast customer/item changes so other tabs/users stay in sync,
-- replacing the app's old cross-tab localStorage 'storage' event sync.
-- Guarded so re-running the migration is a no-op, and a missing
-- supabase_realtime publication (non-standard/self-hosted) doesn't abort
-- the whole migration transaction.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'customers'
    ) then
      alter publication supabase_realtime add table public.customers;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
    ) then
      alter publication supabase_realtime add table public.items;
    end if;
  end if;
end $$;
