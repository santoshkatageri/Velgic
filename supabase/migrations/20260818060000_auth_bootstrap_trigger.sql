-- ============================================================================
-- Velgic V3 — Phase 3B: Supabase Auth bootstrap trigger (on_auth_user_created)
-- ============================================================================
-- Authoritative reference: docs/architecture-v3.md
--   §"Identity, workspaces, membership"
--   §"Row-Level Security" (bootstrap exception)
--
-- Purpose
-- -------
-- When a new user signs up (INSERT into auth.users by Supabase Auth/GoTrue),
-- atomically create their V3 bootstrap state:
--   1. exactly one public.profiles row        (id = auth user UUID)
--   2. exactly one personal public.workspaces row (owner = auth user UUID)
--   3. exactly one public.workspace_members row   (role = 'owner')
--
-- This is the ONLY path in V3 that bypasses RLS on those three tables (it is
-- SECURITY DEFINER and runs as the migration owner). It is hard-coded to the
-- triggering user's own UUID — it can never create rows for another user.
--
-- Scope guardrails
-- ----------------
--   • Does NOT backfill pre-existing auth.users rows (only fires on new INSERT).
--   • Does NOT touch V2 tables (items, experiments, contents, campaigns,
--     platform_contents, assets, asset_references).
--   • Does NOT add/modify any RLS policy, table, column, or index.
--   • Does NOT weaken any existing RLS policy.
--
-- Design review notes (see Phase 3B gate report)
-- ----------------------------------------------
--   search_path/security  : SECURITY DEFINER + SET search_path = public;
--                           every object reference is schema-qualified;
--                           pg_catalog functions (split_part, gen_random_uuid)
--                           resolve via implicit pg_catalog search — no
--                           unqualified user-schema lookups.
--   privilege escalation  : new.id / new.email / new.raw_user_meta_data are
--                           consumed as DATA (bound plpgsql record fields),
--                           never spliced into SQL identifiers or executed.
--                           display_name/avatar_url are plain text columns.
--   uniqueness/idempotency: profiles ON CONFLICT (id) DO NOTHING;
--                           workspaces guarded by EXISTS (owner_id, 'personal');
--                           workspace_members ON CONFLICT (workspace_id,user_id).
--   transactional failure : runs inside the auth.users INSERT transaction —
--                           any failure rolls back the whole signup (a user
--                           can never exist without their bootstrap state).
--   recursion             : the trigger only inserts into public.profiles /
--                           workspaces / workspace_members; none of those have
--                           triggers that write back to auth.users. No loop.
--
--   concurrency / exactly-one-personal-workspace invariant
--   -----------------------------------------------------
--   The bootstrap requires exactly one personal workspace per user. The
--   trigger guards the workspace insert with
--       IF NOT EXISTS (SELECT 1 FROM public.workspaces
--                      WHERE owner_id = new.id AND kind = 'personal')
--   Race assessment (Phase 3B review, approved):
--     • auth.users.id is the PRIMARY KEY of auth.users. The trigger fires
--       AFTER INSERT FOR EACH ROW on auth.users, so for any given new.id the
--       trigger body can only ever run inside a transaction that successfully
--       inserted that auth.users row. Two concurrent INSERTs of the SAME id
--       cannot both commit (PK violation on the loser, whose transaction —
--       including its trigger — rolls back). Therefore the trigger cannot run
--       concurrently twice for the same owner via the auth flow.
--     • The trigger is the ONLY writer of personal workspaces in V3: RLS has
--       no INSERT policy on public.workspaces (API clients cannot create
--       workspaces), and the function is SECURITY DEFINER, invoked only by
--       this trigger. Sequential re-invocation (manual re-run, retry) is
--       made idempotent by the IF NOT EXISTS guard + ON CONFLICT clauses.
--     • Residual gap: if a FUTURE writer (e.g. an admin/backfill migration,
--       a team-workspace feature) ever inserts a personal workspace for a
--       user concurrently with that user's signup, a check-then-insert race
--       is theoretically possible. The minimal DB-level hardening, deferred
--       until such a writer exists, is a partial unique index:
--           create unique index workspaces_one_personal_per_owner
--             on public.workspaces (owner_id)
--             where kind = 'personal';
--       Partial on kind='personal' preserves future workspace kinds
--       (e.g. 'team') while guaranteeing at most one personal workspace per
--       owner under any concurrency. NOT added now — the auth-flow is
--       race-free, and this keeps Phase 3B schema change minimal.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Trigger function
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ws_id uuid;
begin
  -- (1) Profile — 1:1 with auth.users. display_name falls back to the local
  --     part of the email, then to a constant. avatar_url is optional.
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(new.email, '@', 1), ''),
      'New User'
    ),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- (2) Personal workspace — exactly one per user (guard + idempotent re-run).
  if not exists (
    select 1
    from public.workspaces
    where owner_id = new.id
      and kind = 'personal'
  ) then
    insert into public.workspaces (name, owner_id, kind)
    values ('Personal Workspace', new.id, 'personal')
    returning id into ws_id;
  else
    select id into ws_id
    from public.workspaces
    where owner_id = new.id
      and kind = 'personal'
    limit 1;
  end if;

  -- (3) Owner membership — one per (workspace, user).
  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws_id, new.id, 'owner')
  on conflict (workspace_id, user_id) do nothing;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Trigger — AFTER INSERT on auth.users, row level
-- ----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 3. Notes for reviewers
-- ----------------------------------------------------------------------------
--   • No backfill: users who existed before this migration are untouched.
--     A future backfill (if needed) is a separate, explicitly-approved
--     migration — not part of Phase 3B.
--   • The function relies on being owned by a privileged role (the migration
--     runner) so SECURITY DEFINER can bypass RLS for bootstrap only. Trigger
--     execution by GoTrue uses the default PUBLIC EXECUTE grant on the
--     function; no additional grant/revoke is required and none is added.
--   • If the signup must later fail gracefully instead of rolling back when
--     bootstrap fails, that is a product decision for a later phase — for
--     now the atomic behaviour (all-or-nothing signup) is intentional.
--
-- This migration is for local review. It has NOT been pushed or applied.
-- ============================================================================

commit;
