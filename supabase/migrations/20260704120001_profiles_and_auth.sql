-- ============================================================
-- Auth foundation: profiles + auto-provisioning trigger.
--
-- The CRM is team-shared but tracks work by a free-text "salesOwner"
-- name. profiles.sales_owner is what links a logged-in auth user to
-- that name, so the app can resolve the "งานของฉัน" (my work) scope
-- from the session instead of a stored string.
-- ============================================================

-- Fixed set of application roles. Guarded so the migration re-applies cleanly
-- (Postgres has no `create type if not exists`).
do $$
begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin', 'manager', 'sale', 'cs', 'mkt');
  end if;
end $$;

grant usage on type public.app_role to authenticated;

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text,
  sales_owner  text,
  -- NULL role == "pending": a self-registered user with no data access until
  -- an admin grants a role via admin_set_role().
  role         public.app_role,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Safety for a re-apply where the table pre-existed without the column.
alter table public.profiles add column if not exists role public.app_role;

comment on table public.profiles is
  'One row per authenticated user. role gates access (NULL = pending); sales_owner maps the account to the CRM owner name.';

-- Shared trigger fn: keep updated_at current on any row update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-provision a profile whenever a new auth user signs up. SECURITY DEFINER
-- so it can insert past RLS; empty search_path per Supabase hardening guidance.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Role helpers. SECURITY DEFINER so RLS policies on other tables can call
-- user_role() without recursing into profiles' own RLS.
-- ------------------------------------------------------------
create or replace function public.user_role(uid uuid)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = uid;
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Admin-only role assignment. SECURITY DEFINER so it can write another user's
-- role past the column grant + self-only policy below; gated by is_admin().
create or replace function public.admin_set_role(target_user uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can assign roles' using errcode = '42501';
  end if;
  -- Enforce the "can't change your own role" guarantee at the DB layer, not just
  -- in the app — otherwise an admin could self-revoke via a direct RPC call.
  if target_user = auth.uid() then
    raise exception 'Cannot change your own role' using errcode = '42501';
  end if;
  -- Serialize concurrent admin role changes (lock admin rows) and refuse to
  -- demote the last admin, so two admins can't race each other into a
  -- zero-admin lockout.
  perform 1 from public.profiles where role = 'admin' for update;
  if new_role is distinct from 'admin'
    and (select role from public.profiles where id = target_user) = 'admin'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last admin' using errcode = '42501';
  end if;
  update public.profiles
    set role = new_role, updated_at = now()
    where id = target_user;
end;
$$;

-- Scope RPC execution explicitly to authenticated (remove the default PUBLIC
-- execute grant) — belt-and-suspenders on top of the internal auth.uid() checks.
revoke execute on function public.user_role(uuid) from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.admin_set_role(uuid, public.app_role) from public;
grant execute on function public.user_role(uuid) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_set_role(uuid, public.app_role) to authenticated;

-- RLS: teammates can read every profile (to show names + power the admin panel),
-- but a user may only create/update their own row.
alter table public.profiles enable row level security;

-- `drop policy if exists` before each create makes the migration safe to
-- re-apply (Postgres has no `create policy if exists`), matching the
-- `drop ... if exists` idiom used for the triggers above.
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
-- A user may always read their OWN row; the full roster (emails/roles) is
-- visible only to admins (the user-management panel needs it). No other feature
-- reads other users' profiles, so this keeps teammates' PII from being
-- enumerable via the Data API by non-admins.
create policy "Profiles are viewable by self or admins"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- New Supabase projects revoke Data-API access to new tables by default
-- (default flipped 2026-05-30), so grant the authenticated role explicitly.
-- Column-level UPDATE grant is the key guard: users may change only their own
-- display_name/sales_owner — `role` is deliberately NOT grantable, so nobody
-- can self-assign a role. Role changes go solely through admin_set_role().
grant select on public.profiles to authenticated;
-- email is populated only by the handle_new_user trigger (from the verified auth
-- identity), never by the client, so it is not in the insert grant.
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name, sales_owner) on public.profiles to authenticated;
