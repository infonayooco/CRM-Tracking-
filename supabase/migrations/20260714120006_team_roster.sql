-- ============================================================
-- Team roster RPC — minimal (id, display_name) list for populating
-- assignee dropdowns, without exposing email or role to non-admins.
--
-- profiles' own SELECT policy ("self or admin", migration 1) is left
-- completely untouched. A security_invoker view would inherit that policy
-- and only ever return the caller's own row, which defeats the purpose, so
-- this follows the repo's existing pattern for that exact problem
-- (public.user_role / public.is_admin): a SECURITY DEFINER function with an
-- explicit internal guard, rather than a bare RLS-bypassing view. There is
-- no view precedent anywhere in these migrations to be consistent with.
--
-- Access mirrors the `members` table: any authenticated user who themselves
-- has an assigned role (public.user_role(auth.uid()) is not null) may call
-- this; pending (role IS NULL) accounts and anon get zero rows, since the
-- WHERE guard is evaluated for every caller and anon has no EXECUTE grant.
--
-- Only approved accounts are listed (role is not null) — pending signups are
-- excluded. display_name is returned as-is (nullable); it already defaults
-- to the email local-part at signup (see handle_new_user in migration 1)
-- unless cleared, so no further fallback is added here — doing so risks
-- reconstructing the email for non-admins. A null/empty display_name is left
-- for the client to render a placeholder.
--
-- Rollback:
--   revoke execute on function public.list_team_roster() from authenticated;
--   drop function if exists public.list_team_roster();
-- ============================================================

create or replace function public.list_team_roster()
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
  from public.profiles p
  where p.role is not null
    and public.user_role(auth.uid()) is not null;
$$;

comment on function public.list_team_roster() is
  'Minimal team roster (id, display_name) for assignee dropdowns. Excludes email/role columns and pending (role IS NULL) accounts. Callable by any authenticated user who themselves has an assigned role; profiles'' own RLS/SELECT policy is untouched.';

-- Scope execution explicitly to authenticated, matching user_role/is_admin
-- (removes the default PUBLIC execute grant so anon cannot call it — the
-- internal WHERE guard above is belt-and-suspenders on top of this).
revoke execute on function public.list_team_roster() from public;
grant execute on function public.list_team_roster() to authenticated;
