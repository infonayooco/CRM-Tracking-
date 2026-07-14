-- ============================================================
-- Role permission fixes:
--
-- A) cs could update customers/items but not create them. Product decision:
--    cs should be able to create both (delete stays admin/manager only).
--
-- B) BUG: members_write (20260704120002_crm_tables.sql) was a single `for
--    all` policy restricted to admin/manager. But lib/store.ts auto-appends
--    any newly-typed salesOwner into `members` on customer/item save
--    (upsertCustomer/updateCustomer), and the "เพิ่มรายชื่อใหม่" addMember()
--    action (ItemModal) writes there too — both reachable by every role.
--    lib/data/sync.ts pushes all table writes in one Promise.all and only
--    advances lastSynced if the WHOLE batch succeeds, so a single RLS
--    rejection on `members` fails (and endlessly retries) the entire push —
--    customers and items included — for any sale/mkt/cs user the moment a
--    new member name appears. Fix: let any user with an assigned role INSERT
--    a member name (adding a roster name is intended product behavior); keep
--    UPDATE/DELETE on members admin/manager only.
--
-- C) owner_quotas: investigated whether a non-admin/manager code path can
--    mutate ownerQuotas the same way. lib/store.ts's only writer is
--    setOwnerQuota(), called from exactly one place — the quota <input> in
--    OwnerPerformancePanel (components/ReportView.tsx). That input renders
--    for every authenticated role and is NOT gated behind the
--    `team.manage` capability (lib/auth/permissions.ts) the way it should
--    be — grep of components/ shows lib/auth/permissions.ts's `can()` is
--    only wired up in components/admin/RoleForm.tsx and
--    components/auth/AuthBar.tsx, nowhere else. So a sale/cs/mkt user CAN
--    reach setOwnerQuota() today and would hit the same batch-sync-failure
--    bug as (B) the moment they touch that field.
--    Left owner_quotas_write UNCHANGED here per instruction not to loosen
--    write access speculatively: unlike the members roster (an explicitly
--    requested "add name" product feature open to all roles), per-owner
--    revenue quotas are manager-level data with no product ask to open them
--    up. The correct fix is a FRONTEND change — disable/hide the quota
--    input unless `can(role, "team.manage")` — not a DB policy change.
--    Flagging for backend-dev/frontend-dev; out of this migration's scope.
--
-- Rollback:
--   -- A) revert customers_insert / items_insert to exclude cs:
--   drop policy if exists "customers_insert" on public.customers;
--   create policy "customers_insert" on public.customers for insert to authenticated
--     with check (public.user_role(auth.uid()) in ('admin','manager','sale'));
--   drop policy if exists "items_insert" on public.items;
--   create policy "items_insert" on public.items for insert to authenticated
--     with check (public.user_role(auth.uid()) in ('admin','manager','sale','mkt'));
--
--   -- B) revert members to the single admin/manager-only `for all` policy:
--   drop policy if exists "members_insert" on public.members;
--   drop policy if exists "members_update" on public.members;
--   drop policy if exists "members_delete" on public.members;
--   create policy "members_write" on public.members for all to authenticated
--     using (public.user_role(auth.uid()) in ('admin','manager'))
--     with check (public.user_role(auth.uid()) in ('admin','manager'));
-- ============================================================

-- A) customers: cs gains insert (delete stays admin/manager only).
drop policy if exists "customers_insert" on public.customers;
create policy "customers_insert" on public.customers for insert to authenticated
  with check (public.user_role(auth.uid()) in ('admin','manager','sale','cs'));

-- A) items: cs gains insert (delete stays admin/manager only).
drop policy if exists "items_insert" on public.items;
create policy "items_insert" on public.items for insert to authenticated
  with check (public.user_role(auth.uid()) in ('admin','manager','sale','mkt','cs'));

-- B) members: split the single admin/manager-only `for all` policy so any
-- assigned-role user can insert a roster name; update/delete stay
-- admin/manager only.
drop policy if exists "members_write" on public.members;

drop policy if exists "members_insert" on public.members;
create policy "members_insert" on public.members for insert to authenticated
  with check (public.user_role(auth.uid()) is not null);

drop policy if exists "members_update" on public.members;
create policy "members_update" on public.members for update to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'))
  with check (public.user_role(auth.uid()) in ('admin','manager'));

drop policy if exists "members_delete" on public.members;
create policy "members_delete" on public.members for delete to authenticated
  using (public.user_role(auth.uid()) in ('admin','manager'));

-- C) owner_quotas_write: deliberately left unchanged — see note above.
