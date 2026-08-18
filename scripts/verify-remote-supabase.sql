-- ============================================================================
-- Velgic V3 — READ-ONLY remote schema verification
-- ============================================================================
-- Run this in the Supabase Dashboard → SQL Editor, or via:
--     psql "$DB_URL" -f scripts/verify-remote-supabase.sql
--
-- This script performs SELECT-only introspection. It modifies NOTHING.
-- It verifies the remote database against the approved V3 architecture
-- (docs/architecture-v3.md) at migration 20260817180000.
--
-- Expected results (approved architecture):
--   1. contents.linked_idea_id       → items(id)        ON DELETE SET NULL
--   2. contents.linked_experiment_id → experiments(id)  ON DELETE SET NULL
--   3. campaigns.content_id          → contents(id)     ON DELETE CASCADE
--   4. platform_contents.campaign_id → campaigns(id)    ON DELETE CASCADE
--   5. asset_references.asset_id     → assets(id)       ON DELETE NO ACTION (DEFERRABLE INITIALLY DEFERRED)
--   6. asset_references.platform_content_id → platform_contents(id) ON DELETE CASCADE
--   10 tables, RLS enabled on all 10, 33 RLS policies, 15 FKs,
--   platform_contents_validation trigger + 7 updated_at triggers.
--
-- Interpretation notes:
--   • pg_get_constraintdef() prints "ON DELETE NO ACTION" as the DEFAULT,
--     i.e. the clause is OMITTED when the action is NO ACTION. It always
--     prints SET NULL / CASCADE when those are present.
--   • If any row differs from "Expected", report it and STOP — do not
--     proceed to Phase 3 until resolved.
-- ============================================================================

\echo '══════════════════════════════════════════════════════════════════'
\echo '1. Tables in public schema (expect exactly 10)'
\echo '══════════════════════════════════════════════════════════════════'
select tablename
from pg_tables
where schemaname = 'public'
  and tablename not like 'pg_%'
  and tablename not in ('schema_migrations', 'migrations')
order by tablename;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '2. RLS enabled on all 10 tables (relrowsecurity = true ×10)'
\echo '══════════════════════════════════════════════════════════════════'
select c.relname,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
order by c.relname;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '3. RLS policies (expect 33 rows)'
\echo '══════════════════════════════════════════════════════════════════'
select p.polrelid::regclass as table_name,
       p.polname as policy_name,
       case p.polcmd
         when 'r' then 'SELECT'
         when 'a' then 'INSERT'
         when 'w' then 'UPDATE'
         when 'd' then 'DELETE'
         when '*' then 'ALL'
       end as command,
       pg_get_expr(p.polqual, p.polrelid) as using_expr,
       pg_get_expr(p.polwithcheck, p.polrelid) as with_check_expr
from pg_policy p
order by table_name::text, policy_name;

select count(*) as total_policies
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relnamespace = 'public'::regnamespace;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '4. Foreign keys (expect 15 rows) — THE critical check'
\echo '══════════════════════════════════════════════════════════════════'
select conrelid::regclass as table_name,
       conname as constraint_name,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
order by table_name::text, conname;

select count(*) as total_foreign_keys
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '4a. Focused FK check — the 6 architecture-critical relationships'
\echo '══════════════════════════════════════════════════════════════════'
select conrelid::regclass as table_name,
       conname,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'f'
  and connamespace = 'public'::regnamespace
  and (
    (conrelid = 'public.contents'::regclass and conname in ('contents_linked_idea_id_fkey', 'contents_linked_experiment_id_fkey'))
    or (conrelid = 'public.campaigns'::regclass and conname = 'campaigns_content_id_fkey')
    or (conrelid = 'public.platform_contents'::regclass and conname = 'platform_contents_campaign_id_fkey')
    or (conrelid = 'public.asset_references'::regclass and conname in ('asset_references_asset_id_fkey', 'asset_references_platform_content_id_fkey'))
  )
order by table_name::text, conname;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '5. Triggers (expect 8 non-internal rows)'
\echo '══════════════════════════════════════════════════════════════════'
select t.tgrelid::regclass as table_name,
       t.tgname,
       pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where not t.tgisinternal
  and t.tgrelid::regnamespace = 'public'::regnamespace
order by table_name::text, t.tgname;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '5a. Validation trigger on platform_contents (expect 1 row:'
\echo '    platform_contents_validation — before insert or update of'
\echo '    published_url, schedule_timezone)'
\echo '══════════════════════════════════════════════════════════════════'
select tgname,
       pg_get_triggerdef(oid) as definition
from pg_trigger
where not tgisinternal
  and tgrelid = 'public.platform_contents'::regclass
order by tgname;

\echo ''
\echo '══════════════════════════════════════════════════════════════════'
\echo '6. Migration tracking (expect 20260817180000_init_schema.sql applied)'
\echo '══════════════════════════════════════════════════════════════════'
select version, name
from supabase_migrations.schema_migrations
order by version;
