-- ============================================================================
-- Velgic V3 — Phase 2: initial schema, RLS enablement, RLS policies
-- ============================================================================
-- Authoritative reference: docs/architecture-v3.md
--   §"Domain → PostgreSQL mapping"
--   §"Row-Level Security"
--   §"Identity, workspaces, membership"
--
-- Scope of THIS migration:
--   1. Ten tables (profiles, workspaces, workspace_members, items,
--      experiments, contents, campaigns, platform_contents, assets,
--      asset_references) with relationships + FK cascades matching the
--      V2 useStore reducers.
--   2. CHECK constraints mirroring every V2 enum in src/lib/constants.ts
--      and the V2 type invariants in src/types.ts.
--   3. Indexes.
--   4. RLS enablement on every table.
--   5. RLS policies: canonical workspace-membership pattern + the
--      profiles / workspaces / workspace_members bootstrap exceptions.
--   6. Data-API grants for the `authenticated` role (the project has
--      "automatic table exposure" disabled, so grants are explicit).
--
-- NOT in this migration (later phases):
--   • on_auth_user_created bootstrap trigger        (Phase 3)
--   • storage bucket + storage.objects policies     (Phase 5)
--   • manifest_import RPC                            (Phase 7)
--   • seed data — lives in supabase/seed.sql (idempotent, re-run by
--     `supabase db reset`; kept out of migrations so schema files stay
--     pure and re-runnable)
--
-- The seed.sql counterpart is the V3 mirror of src/data/seed.ts
-- (see §"Seed mapping to src/data/seed.ts" in the Phase 2 review notes).
--
-- This file is for local review ONLY. It has NOT been applied to any
-- Supabase project.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 0. Extension
-- ----------------------------------------------------------------------------
-- gen_random_uuid() is core in PostgreSQL 13+; the extension is declared
-- defensively for older environments. pgcrypto is preinstalled on Supabase.
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. Helper: set_updated_at trigger function
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1a. Helper: platform-contents validation trigger function
-- ----------------------------------------------------------------------------
-- PostgreSQL CHECK constraints cannot reference other tables or views, so
-- IANA timezone validation (which queries the pg_timezone_names catalog
-- view) and empty-string normalisation for published_url are handled in a
-- BEFORE trigger instead of an invalid CHECK subquery.
create or replace function public.validate_platform_contents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Normalise empty-string published_url to NULL (V2 manifest contract:
  -- published_url is NULL when the post is not live; '' is never a valid
  -- value — it would also fail the http(s) CHECK above).
  if new.published_url = '' then
    new.published_url := null;
  end if;

  -- Validate IANA timezone when schedule_timezone is set.
  -- pg_timezone_names is a PostgreSQL system catalog view that lists every
  -- known IANA timezone name. Safe in a trigger because the view is
  -- static between server versions.
  if new.schedule_timezone is not null then
    if not exists (select 1 from pg_timezone_names where name = new.schedule_timezone) then
      raise exception 'Invalid IANA timezone: "%"', new.schedule_timezone;
    end if;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Tables
-- ----------------------------------------------------------------------------

-- 3.1 profiles — 1:1 with auth.users (auth.users.id = profiles.id)
create table public.profiles (
  id           uuid primary key,
  display_name text not null,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 3.2 workspaces — the ownership container. V3 ships only 'personal'.
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind = 'personal'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.3 workspace_members — owner/editor/viewer roles are in the schema;
--     team-management UI is deferred (V3 is personal-workspace-first).
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         text not null check (role in ('owner', 'editor', 'viewer')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

-- 3.4 items — the V2 unified Pipeline entity (Idea Inbox + Pipeline +
--     Published records share this shape by design; see architecture-v3.md
--     §"Items domain decision"). `stage` is a PRODUCTION state, never a
--     distribution state.
create table public.items (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  v2_id              text not null,
  title              text not null,
  problem            text not null default '',
  category           text not null default '',
  audience           text not null default '',
  format             text not null default '',
  estimated_effort   int  not null check (estimated_effort between 1 and 5),
  potential_impact   int  not null check (potential_impact between 1 and 10),
  reusable           boolean not null default false,
  stage              text not null default 'ideas'
                     check (stage in ('ideas', 'research', 'script', 'production', 'published')),
  priority           text not null default 'medium'
                     check (priority in ('low', 'medium', 'high')),
  notes              text not null default '',
  scores             jsonb not null default '{}'::jsonb,
  core_idea          text not null default '',
  hook               text not null default '',
  audience_problem   text not null default '',
  key_insight        text not null default '',
  script             text not null default '',
  visual_plan        text not null default '',
  production_notes   text not null default '',
  linkedin_post      text not null default '',
  instagram_caption  text not null default '',
  checklist          jsonb not null default '[]'::jsonb,
  performance        jsonb,
  lessons_learned    text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, v2_id)
);

-- 3.5 experiments
create table public.experiments (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces (id) on delete cascade,
  v2_id           text not null,
  name            text not null,
  status          text not null check (status in ('planned', 'running', 'done')),
  outcome         text not null check (outcome in ('success', 'mixed', 'failed')),
  hypothesis      text not null default '',
  what_was_built  text not null default '',
  tools           text not null default '',
  time_spent      text not null default '',
  result          text not null default '',
  metrics         jsonb not null default '[]'::jsonb,
  what_worked     text not null default '',
  what_failed     text not null default '',
  key_learning    text not null default '',
  follow_up_idea  text not null default '',
  worth_repeating boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (workspace_id, v2_id)
);

-- 3.6 contents — V2 ContentItem. Content does NOT require an experiment or
--     an idea: linked_idea_id / linked_experiment_id are nullable.
create table public.contents (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces (id) on delete cascade,
  v2_id                text not null,
  title                text not null,
  concept              text not null,
  origin               text not null
                       check (origin in ('idea', 'experiment', 'research', 'observation',
                                         'opinion', 'trend', 'personal_experience', 'direct')),
  audience             text not null,
  content_type         text not null
                       check (content_type in ('reel', 'carousel', 'short_video',
                                               'linkedin_post', 'x_post', 'x_thread',
                                               'youtube_short', 'youtube_video',
                                               'article', 'tutorial')),
  format               text not null default '',
  hook                 text not null default '',
  draft                text not null default '',
  notes                text not null default '',
  status               text not null
                       check (status in ('draft', 'in_production', 'ready', 'published', 'archived')),
  linked_idea_id       uuid references public.items (id) on delete set null,
  linked_experiment_id uuid references public.experiments (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (workspace_id, v2_id)
);

-- 3.7 campaigns — NOTE: no `platforms` column. platform_contents.platform
--     is the single source of truth; the app derives the V2
--     `Campaign.platforms` mirror on read (architecture-v3.md §1.4a).
create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  v2_id        text not null,
  content_id   uuid not null references public.contents (id) on delete cascade,
  name         text not null,
  description  text not null default '',
  status       text not null
               check (status in ('draft', 'ready', 'partially_published', 'published', 'archived')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (workspace_id, v2_id)
);

-- 3.8 platform_contents — one row per (campaign × platform). The V2
--     PlatformContent.assets[] array is reified into asset_references;
--     platform-specific metadata is NOT flattened (one jsonb column per
--     platform, enforced by CHECK).
create table public.platform_contents (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  v2_id              text not null,
  campaign_id        uuid not null references public.campaigns (id) on delete cascade,
  platform           text not null check (platform in ('instagram', 'youtube', 'linkedin', 'x')),
  format             text not null
                     check (
                       (platform = 'instagram' and format in ('Reel', 'Carousel', 'Post'))
                       or (platform = 'youtube'   and format in ('Short', 'Video'))
                       or (platform = 'linkedin'  and format in ('Post', 'Article'))
                       or (platform = 'x'         and format in ('Post', 'Thread'))
                     ),
  status             text not null check (status in ('draft', 'ready', 'scheduled', 'published', 'failed')),
  published_url      text check (published_url is null or published_url ~* '^https?://.+'),
  published_at       timestamptz,
  notes              text not null default '',
  schedule_enabled   boolean not null default false,
  schedule_datetime  timestamptz,
  schedule_timezone  text,
  instagram          jsonb,
  youtube            jsonb,
  linkedin           jsonb,
  x                  jsonb,
  metrics            jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- V2 invariant: platform-specific metadata is never flattened AND exactly
  -- one platform's metadata object exists, matching the `platform` value.
  check (
    (platform = 'instagram' and instagram is not null and youtube is null and linkedin is null and x is null)
    or (platform = 'youtube'   and youtube   is not null and instagram is null and linkedin is null and x is null)
    or (platform = 'linkedin'  and linkedin  is not null and instagram is null and youtube is null and x is null)
    or (platform = 'x'         and x         is not null and instagram is null and youtube is null and linkedin is null)
  ),
  -- V2 schedule rule: enabled=true requires a datetime.
  check (not schedule_enabled or schedule_datetime is not null),
  unique (workspace_id, v2_id)
);

-- 3.9 assets — the reusable reference-only library. `asset_id` is the V2
--     canonical text id (e.g. 'instagram-reel-03'); `id` is the synthetic
--     stable FK target. No binary media is ever stored.
create table public.assets (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces (id) on delete cascade,
  asset_id          text not null,
  filename          text not null,
  type              text not null check (type in ('video', 'image', 'audio', 'document', 'link')),
  reference         text not null,
  provider          text not null check (provider in ('local', 'supabase')),
  role              text check (role is null or role in ('video', 'thumbnail', 'media')),
  mime_type         text,
  size              bigint,
  duration          int,
  library_notes     text not null default '',
  library_created_at timestamptz not null default now(),
  unique (workspace_id, asset_id)
);

-- 3.10 asset_references — M:N assets × platform_contents. The per-usage
--      `role` can differ from the library's `role` (V2 semantics: the same
--      asset can be 'media' on one platform and 'thumbnail' on another).
--      asset_id → assets uses NO ACTION … DEFERRED so that:
--        • a direct delete of a still-referenced asset fails (V2's
--          "deletion is blocked while referenced" invariant), and
--        • workspace/PC cascades that legitimately remove references
--          within the same transaction do not false-positive.
create table public.asset_references (
  asset_id            uuid not null,
  platform_content_id uuid not null,
  role                text check (role is null or role in ('video', 'thumbnail', 'media')),
  created_at          timestamptz not null default now(),
  primary key (asset_id, platform_content_id),
  foreign key (asset_id)            references public.assets (id)            on delete no action deferrable initially deferred,
  foreign key (platform_content_id) references public.platform_contents (id) on delete cascade
);

-- ----------------------------------------------------------------------------
-- 3.11 Helper: workspace-membership check used by every RLS policy
-- ----------------------------------------------------------------------------
-- NOTE: this function MUST be created AFTER the tables — PostgreSQL parses
-- SQL-language function bodies at CREATE FUNCTION time (check_function_bodies
-- defaults to on), so referencing public.workspace_members here requires the
-- table to exist already.
-- SECURITY DEFINER so policies do not recurse into workspace_members' own
-- RLS, and so the Phase 3 bootstrap trigger can create memberships without a
-- live session. auth.uid() is read from the request JWT (NULL outside a
-- request context — policies only run inside PostgREST requests).
create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- 4. updated_at triggers (every writable table except assets and
--    workspace_members, which have no V2 updatedAt equivalent)
-- ----------------------------------------------------------------------------
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workspaces_set_updated_at
  before update on public.workspaces
  for each row execute function public.set_updated_at();

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create trigger experiments_set_updated_at
  before update on public.experiments
  for each row execute function public.set_updated_at();

create trigger contents_set_updated_at
  before update on public.contents
  for each row execute function public.set_updated_at();

create trigger campaigns_set_updated_at
  before update on public.campaigns
  for each row execute function public.set_updated_at();

create trigger platform_contents_set_updated_at
  before update on public.platform_contents
  for each row execute function public.set_updated_at();

create trigger platform_contents_validation
  before insert or update of published_url, schedule_timezone
  on public.platform_contents
  for each row execute function public.validate_platform_contents();

-- ----------------------------------------------------------------------------
-- 5. Indexes
-- ----------------------------------------------------------------------------
-- PKs and UNIQUE constraints above already create:
--   items(workspace_id, v2_id), experiments(workspace_id, v2_id),
--   contents(workspace_id, v2_id), campaigns(workspace_id, v2_id),
--   platform_contents(workspace_id, v2_id), assets(workspace_id, asset_id),
--   asset_references(asset_id, platform_content_id)

create index idx_items_workspace_stage
  on public.items (workspace_id, stage);

create index idx_experiments_workspace_status
  on public.experiments (workspace_id, status);

create index idx_contents_workspace_status
  on public.contents (workspace_id, status);

create index idx_contents_linked_idea
  on public.contents (linked_idea_id);

create index idx_contents_linked_experiment
  on public.contents (linked_experiment_id);

create index idx_campaigns_content
  on public.campaigns (content_id);

create index idx_platform_contents_campaign
  on public.platform_contents (campaign_id);

create index idx_platform_contents_workspace_platform
  on public.platform_contents (workspace_id, platform);

create index idx_asset_references_platform_content
  on public.asset_references (platform_content_id);

-- ----------------------------------------------------------------------------
-- 6. RLS enablement
-- ----------------------------------------------------------------------------
-- The provisioned project has "automatic RLS disabled", so every table must
-- be enabled explicitly here.
alter table public.profiles          enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.items             enable row level security;
alter table public.experiments       enable row level security;
alter table public.contents          enable row level security;
alter table public.campaigns         enable row level security;
alter table public.platform_contents enable row level security;
alter table public.assets            enable row level security;
alter table public.asset_references  enable row level security;

-- ----------------------------------------------------------------------------
-- 7. RLS policies
-- ----------------------------------------------------------------------------
-- 7.1 profiles — bootstrap exception: a user reads/updates ONLY their own
--     profile. INSERT/DELETE are deliberately absent: the Phase 3
--     on_auth_user_created trigger (SECURITY DEFINER) is the only creator,
--     and profiles are never deleted by the application.
create policy "users can select own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- 7.2 workspaces — bootstrap exception: members read/update their
--     workspaces; INSERT/DELETE are absent (workspaces are created by the
--     Phase 3 trigger only, never deleted by the app).
create policy "members can select workspaces" on public.workspaces
  for select using (public.is_workspace_member(id));

create policy "members can update workspaces" on public.workspaces
  for update using (public.is_workspace_member(id)) with check (public.is_workspace_member(id));

-- 7.3 workspace_members — bootstrap exception: a user can only read their
--     OWN memberships. INSERT/UPDATE/DELETE are absent (bootstrap trigger
--     only; owner-driven team management UI is deferred — the owner/editor/
--     viewer role column exists in the schema for that future).
create policy "users can select own memberships" on public.workspace_members
  for select using (user_id = auth.uid());

-- 7.4–7.10 workspace-scoped content tables — canonical membership pattern.
--     Same four policies per table (SELECT/INSERT/UPDATE/DELETE), all gated
--     by public.is_workspace_member(workspace_id).

-- items
create policy "members can select items" on public.items
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert items" on public.items
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update items" on public.items
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete items" on public.items
  for delete using (public.is_workspace_member(workspace_id));

-- experiments
create policy "members can select experiments" on public.experiments
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert experiments" on public.experiments
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update experiments" on public.experiments
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete experiments" on public.experiments
  for delete using (public.is_workspace_member(workspace_id));

-- contents
create policy "members can select contents" on public.contents
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert contents" on public.contents
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update contents" on public.contents
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete contents" on public.contents
  for delete using (public.is_workspace_member(workspace_id));

-- campaigns
create policy "members can select campaigns" on public.campaigns
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert campaigns" on public.campaigns
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update campaigns" on public.campaigns
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete campaigns" on public.campaigns
  for delete using (public.is_workspace_member(workspace_id));

-- platform_contents
create policy "members can select platform_contents" on public.platform_contents
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert platform_contents" on public.platform_contents
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update platform_contents" on public.platform_contents
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete platform_contents" on public.platform_contents
  for delete using (public.is_workspace_member(workspace_id));

-- assets
create policy "members can select assets" on public.assets
  for select using (public.is_workspace_member(workspace_id));

create policy "members can insert assets" on public.assets
  for insert with check (public.is_workspace_member(workspace_id));

create policy "members can update assets" on public.assets
  for update using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can delete assets" on public.assets
  for delete using (public.is_workspace_member(workspace_id));

-- asset_references — no workspace_id column; RLS derives membership from
-- both FK endpoints. INSERT additionally requires BOTH the referenced
-- platform_content AND the referenced asset to belong to a workspace the
-- caller is a member of (V3 is personal-workspace-first, so both resolve
-- to the same workspace in practice).
create policy "members can select asset_references" on public.asset_references
  for select using (
    exists (
      select 1 from public.platform_contents pc
      where pc.id = asset_references.platform_content_id
        and public.is_workspace_member(pc.workspace_id)
    )
  );

create policy "members can insert asset_references" on public.asset_references
  for insert with check (
    exists (
      select 1 from public.platform_contents pc
      where pc.id = asset_references.platform_content_id
        and public.is_workspace_member(pc.workspace_id)
    )
    and exists (
      select 1 from public.assets a
      where a.id = asset_references.asset_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "members can update asset_references" on public.asset_references
  for update using (
    exists (
      select 1 from public.platform_contents pc
      where pc.id = asset_references.platform_content_id
        and public.is_workspace_member(pc.workspace_id)
    )
  )
  with check (
    exists (
      select 1 from public.platform_contents pc
      where pc.id = asset_references.platform_content_id
        and public.is_workspace_member(pc.workspace_id)
    )
    and exists (
      select 1 from public.assets a
      where a.id = asset_references.asset_id
        and public.is_workspace_member(a.workspace_id)
    )
  );

create policy "members can delete asset_references" on public.asset_references
  for delete using (
    exists (
      select 1 from public.platform_contents pc
      where pc.id = asset_references.platform_content_id
        and public.is_workspace_member(pc.workspace_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Data-API grants (the project has "automatic table exposure" disabled).
-- ----------------------------------------------------------------------------
-- PostgREST exposes a table to a role only when that role holds privileges
-- on it; RLS then governs rows. `authenticated` gets full CRUD (policies
-- decide what actually succeeds). `anon` intentionally gets NOTHING —
-- Velgic V3 is fully auth-gated.
grant usage on schema public to authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.items,
  public.experiments,
  public.contents,
  public.campaigns,
  public.platform_contents,
  public.assets,
  public.asset_references
  to authenticated;

-- The RLS helper must be executable by the roles that run policies.
grant execute on function public.is_workspace_member(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 9. Sanity snapshot (review aid only — no rows expected at this point)
-- ----------------------------------------------------------------------------
comment on table public.profiles          is 'Velgic V3 — 1:1 with auth.users';
comment on table public.workspaces        is 'Velgic V3 — ownership container (kind=personal in V3)';
comment on table public.workspace_members is 'Velgic V3 — membership with owner/editor/viewer role';
comment on table public.items             is 'Velgic V3 — V2 unified Pipeline entity (ideas/pipeline/published)';
comment on table public.experiments       is 'Velgic V3 — V2 experiment log';
comment on table public.contents          is 'Velgic V3 — V2 ContentItem (distribution concept)';
comment on table public.campaigns         is 'Velgic V3 — V2 Campaign; platforms derived from platform_contents';
comment on table public.platform_contents is 'Velgic V3 — V2 PlatformContent; per-platform metadata not flattened';
comment on table public.assets            is 'Velgic V3 — reference-only reusable asset library';
comment on table public.asset_references  is 'Velgic V3 — M:N assets × platform_contents with per-usage role';

-- ----------------------------------------------------------------------------
-- 10. RLS verification matrix (for review — run these on a local Supabase
--     instance to confirm workspace isolation before promoting to prod)
-- ----------------------------------------------------------------------------
-- The GRANTS in §8 give the `authenticated` role full table-level access
-- (SELECT / INSERT / UPDATE / DELETE on every table). RLS policies in §7
-- then restrict that access at the row level. Because the policies use
-- `auth.uid()` and `public.is_workspace_member()`, which both respect the
-- current JWT identity, workspace isolation is enforced per-request:
--
--   SCENARIO                                        EXPECTED BEHAVIOUR
--   ──────────────────────────────────────────────  ──────────────────────────
--   User A signs in → JWT sub = user-A-uuid
--     → SELECT * FROM items                         returns only rows in
--       (RLS policy calls is_workspace_member          workspaces where
--        which checks workspace_members                user-A owns
--        WHERE user_id = user-A-uuid)                  workspace_id
--
--   User A attempts:
--     SELECT * FROM items
--       WHERE workspace_id = '<User-B-workspace>'   0 rows — RLS denies
--
--   User A attempts:
--     INSERT INTO items (workspace_id, v2_id, ...)
--       VALUES ('<User-B-workspace>', ...)          ERROR — WITH CHECK
--                                                         fails membership
--
--   User B attempts:
--     SELECT * FROM profiles                         only own profile
--       (auth.uid() = id)                             (auth.uid() = id)
--
--   User A attempts:
--     INSERT INTO asset_references
--       (asset_id, platform_content_id)
--       VALUES (a1, pc1)                              BLOCKED if pc1 belongs
--       WHERE pc1 platform_content                    to User-B's workspace
--       belongs to User-B                             (see §7.10 insert check)
--
-- To run these tests manually against the local Supabase:
--   1. supabase start (boots Postgres + GoTrue + Studio)
--   2. supabase db reset (applies migrations + seed)
--   3. In seed.sql, create two test users with separate workspaces
--      (or use the existing seed identity + a second manually created user)
--   4. Authenticate as each user via the API or via
--      the dashboard's SQL editor (service_role bypasses RLS, so use a
--      direct supabase-js client with the user's JWT instead).
--
-- An automated acceptance test suite (scripts/acceptance-v3-rls.ts) will
-- be added in Phase 3/4 to enforce the matrix above in CI.
-- ============================================================================
commit;
