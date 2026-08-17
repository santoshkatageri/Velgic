# Velgic V3 — Architecture (Authoritative)

Velgic V3 is **Persistent Creator Intelligence**. It introduces reliable
server-side persistence (Supabase PostgreSQL), identity (Supabase Auth),
workspace ownership with Row-Level Security, and Supabase Storage — **without**
redesigning V2's domain model. V2's `ContentItem`, `Campaign`,
`PlatformContent`, `AssetRef`, and the Velgic Publishing Manifest v1.0
contract remain exactly as documented in
[`docs/architecture-2x.md`](architecture-2x.md) and
[`docs/velgic-publishing-manifest.md`](velgic-publishing-manifest.md).

> **V3 status: Phase 1 — local foundation only.** Until later phases land,
> V3 introduces no behavioral change. V2 acceptance tests
> (`scripts/acceptance-publishing-manifest.ts`,
> `scripts/acceptance-ai-roundtrip.ts`, `scripts/acceptance-2x-final.ts`,
> 291/291), `npx tsc`, and `npm run build` continue to be the source of
> truth for "V2 still works."

## Goals & non-goals

Goals:

- One Supabase Postgres database as the authoritative source of truth.
- One Supabase Auth provider with email/password + Google OAuth.
- Row-Level Security enforced on every writable table.
- One private Storage bucket, layout enforced via RLS.
- Migration of V2 localStorage data into the user's personal workspace —
  data-safe, idempotent, and never deleting the original payload until the
  user verifies.
- V3 product scope is **strictly personal-workspace-first** — schema is
  future-ready, but team management UI, invitations, workspace switching,
  organization hierarchy, billing, and collaboration remain deferred.

Non-goals for V3:

- Realtime subscriptions, collaborative cursors, and Kanban realtime.
- Server-side AI provider integration (V3 only uses the existing copy-paste
  AI workflow from V2).
- Server-side posting / scheduling (V3 keeps V2's fully-manual publishing).
- Automatic binary media migration from V2 (V2 assets are reference-only).
- A bespoke REST/API server.

## Architectural evolution from V2

| Concern | V2 | V3 |
|---|---|---|
| Identity | None (single browser) | Supabase Auth — `auth.users → profiles` |
| Persistence | `Zustand + persist` → `localStorage` | Postgres as authoritative state; Zustand holds an application/UI cache |
| Workspace | Implied (browser-local) | Explicit `workspaces + workspace_members` |
| Storage | Reference strings (`StorageProvider` abstraction) | Supabase Storage, one private bucket, same `StorageProvider` interface |
| Publishing manifest | Stable JSON contract (this is unchanged in V3) | Same contract; server-validated via the `manifest_import` RPC for atomicity |
| Asset references | Reusable library + per-PlatformContent copies | Same dual model on top of Postgres with `(workspace_id, asset_id)` dedup |
| Platform-specific metadata | Not flattened — kept by `platform` key | Same — encoded into per-platform `jsonb` columns (`instagram`, `youtube`, `linkedin`, `x`) on `platform_contents` |
| Statuses | Four independent axes: Pipeline / Content / Publish / Campaign | Same axes — encoded on the same rows |

V2 invariants that V3 **must** preserve are restated in
**§"Invariants carried forward from V2"** below.

## Architecture

```text
Cloudflare Pages (kept — existing static SPA host)
  └── Velgic SPA (Vite + React 18 + Zustand + TS)
         │
         │  supabase-js  (@supabase/supabase-js)
         ▼
Supabase Free tier (target for dev + initial deploy)
  ├── Auth (GoTrue)              email/password + Google OAuth
  ├── Postgres                   schema below, RLS below
  └── Storage                    one private bucket `velgic-assets`
```

- The SPA never talks to anything but `supabase-js` and `supabase-js` only.
- Edge Functions, Realtime, and a custom API server are explicitly OFF
  unless a later phase forces them. Manifest import (the only multi-row
  transactional operation in V3 first cut) goes through one narrowly scoped
  Postgres function called via `supabase.rpc(...)`. See §"API surface".

## Domain → PostgreSQL mapping

Ten tables in the V3 first-cut schema. Conventions:

- Every writable table has `created_at`/`updated_at` timestamptz.
- Every writable table except `profiles`, `workspaces`, `workspace_members`
  carries `workspace_id uuid` and is gated by the canonical membership
  policy in **§"Row-Level Security"**.
- All V2 enum string values from `src/lib/constants.ts` (`CONTENT_TYPES`,
  `CONTENT_ORIGINS`, `CONTENT_STATUSES`, `PUBLISH_STATUSES`,
  `CAMPAIGN_STATUSES`, `ASSET_TYPES`, `ASSET_ROLES`, `PLATFORM_KEYS`,
  four Pipeline `STAGES`, three `PRIORITIES`, plus the `items`-scoped
  enums `EXPERIMENT_STATUSES`/`EXPERIMENT_OUTCOMES`) are mirrored into
  CHECK constraints so V2 application code keeps writing the same strings
  and manifest export stays unchanged.
- The `items` table preserves V2's unified Pipeline shape. See
  **§"Items domain decision"** for why.

### `profiles`

```sql
id           uuid PRIMARY KEY              -- = auth.users.id
display_name text NOT NULL
avatar_url   text
created_at   timestamptz
updated_at   timestamptz
```

### `workspaces`

```sql
id          uuid PRIMARY KEY
name        text NOT NULL
owner_id    uuid NOT NULL REFERENCES profiles(id)
kind        text NOT NULL CHECK (kind IN ('personal'))  -- V3 ships only 'personal'
created_at  timestamptz
updated_at  timestamptz
```

### `workspace_members`

```sql
workspace_id uuid REFERENCES workspaces(id)
user_id      uuid REFERENCES profiles(id)
role         text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer'))
created_at   timestamptz
PRIMARY KEY (workspace_id, user_id)
```

### `items` (V2 unified shape — see §"Items domain decision")

```sql
id                 uuid PRIMARY KEY
workspace_id       uuid NOT NULL REFERENCES workspaces(id)
title              text NOT NULL
problem            text
category           text
audience           text
format             text
estimated_effort   int
potential_impact   int
reusable           bool
stage              text NOT NULL       -- 'ideas' | 'research' | 'script' | 'production' | 'published'
priority           text NOT NULL       -- 'low' | 'medium' | 'high'
notes              text
scores             jsonb NOT NULL
core_idea          text
hook               text
audience_problem   text
key_insight        text
script             text
visual_plan        text
production_notes   text
linkedin_post      text
instagram_caption  text
checklist          jsonb
performance        jsonb
lessons_learned    text
created_at, updated_at
```

### `experiments`

```sql
id              uuid PRIMARY KEY
workspace_id    uuid NOT NULL REFERENCES workspaces(id)
name            text NOT NULL
status          text NOT NULL CHECK (status IN ('planned', 'running', 'done'))
outcome         text NOT NULL CHECK (outcome IN ('success', 'mixed', 'failed'))
hypothesis      text
what_was_built  text
tools           text
time_spent      text
result          text
metrics         jsonb
what_worked     text
what_failed     text
key_learning    text
follow_up_idea  text
worth_repeating bool
created_at, updated_at
```

### `contents` (V2 ContentItem)

```sql
id                    uuid PRIMARY KEY
workspace_id          uuid NOT NULL REFERENCES workspaces(id)
title                 text NOT NULL
concept               text NOT NULL
origin                text NOT NULL   -- CHECK on {idea, experiment, research, observation, opinion, trend, personal_experience, direct}
audience              text NOT NULL
content_type          text NOT NULL   -- CHECK on V2 CONTENT_TYPES
format                text
hook                  text
draft                 text
notes                 text
status                text NOT NULL   -- CHECK on CONTENT_STATUSES
linked_idea_id        uuid REFERENCES items(id)
linked_experiment_id  uuid REFERENCES experiments(id)
created_at, updated_at
```

### `campaigns` (V2 Campaign — **NO** `platforms` column)

```sql
id           uuid PRIMARY KEY
workspace_id uuid NOT NULL REFERENCES workspaces(id)
content_id   uuid NOT NULL REFERENCES contents(id)
name         text NOT NULL
description  text
status       text NOT NULL   -- CHECK on CAMPAIGN_STATUSES
created_at, updated_at
```

`campaigns` does **not** carry a `platforms` column. `platform_contents`
is the source of truth for which platforms a campaign distributes to; the
application derives the V2 `Campaign.platforms[]` mirror when mapping rows
back to the application-level types.

### `platform_contents` (V2 PlatformContent — **sole** source of truth for `platform`)

```sql
id                  uuid PRIMARY KEY
workspace_id        uuid NOT NULL REFERENCES workspaces(id)
campaign_id         uuid NOT NULL REFERENCES campaigns(id)
platform            text NOT NULL          -- CHECK on PLATFORM_KEYS
format              text NOT NULL          -- per-platform canonical title-case: 'Reel'|'Carousel'|'Post'|'Short'|'Video'|'Article'|'Thread'
status              text NOT NULL          -- CHECK on PUBLISH_STATUSES
published_url       text
published_at        timestamptz
notes               text
schedule_enabled    bool NOT NULL
schedule_datetime   timestamptz
schedule_timezone   text                   -- IANA name, validated server-side by the manifest RPC
instagram           jsonb                  -- present iff platform='instagram' (caption, hashtags, location)
youtube             jsonb                  -- present iff platform='youtube'   (title, description, tags)
linkedin            jsonb                  -- present iff platform='linkedin'  (post_text)
x                   jsonb                  -- present iff platform='x'         (content, is_thread, thread)
metrics             jsonb                  -- optional manual analytics (legacy V2)
created_at, updated_at
```

The application rebuilds V2's `Campaign.platforms[]` from the distinct
`platform` values across a campaign's `platform_contents` rows. No
duplicate platform state in Postgres.

### `assets` (canonical library entry)

```sql
id                uuid PRIMARY KEY
workspace_id      uuid NOT NULL REFERENCES workspaces(id)
asset_id          text NOT NULL       -- the V2 logical id (`instagram-reel-01`, etc.)
filename          text NOT NULL
type              text NOT NULL       -- CHECK on ASSET_TYPES
reference         text NOT NULL       -- for 'local' rows: the V2 reference path; for 'supabase' rows: '{workspace_id}/{asset_id}/{filename}'
provider          text NOT NULL       -- 'local' | 'supabase'
role              text                -- CHECK on ASSET_ROLES or NULL
mime_type         text
size              bigint
duration          int
library_notes     text
library_created_at timestamptz
created_at, updated_at
UNIQUE (workspace_id, asset_id)
```

### `asset_references` (the M:N between `assets` and `platform_contents`)

```sql
asset_id            uuid REFERENCES assets(id)
platform_content_id uuid REFERENCES platform_contents(id)
role                text            -- per-usage role can differ from the library's `role`
created_at          timestamptz
PRIMARY KEY (asset_id, platform_content_id)
```

`asset_references.role` carries the per-usage role (matching V2's
behaviour: the same library asset can be `role='media'` on one Instagram
post and `role='thumbnail'` on a YouTube thumbnail).

---

### Items domain decision

V2's `Item` (`src/types.ts`) serves three usage modes under one shape:

- **Idea capture**: inbox items scored for opportunity, `score 0–40`.
- **Production pipeline**: items in `research → script → production`
  carrying `coreIdea`, `hook`, `script`, `visualPlan`, `linkedInPost`,
  `instagramCaption`, `checklist`, etc.
- **Published record**: items in `stage='published'` carrying
  `performance` and `lessonsLearned` for Insights.

The V2 architecture is explicit that this unified shape is deliberate and
that `ContentItem` is the V2 distribution concept (independent of
`Item`). V2's UI surfaces (Kanban, Ideas, Dashboard recommendation
engine, Insights) actively use the unified shape; V2's 291-check
acceptance suite asserts end-to-end behaviour across all five stages.

V3 therefore:

- **Preserves** `Item` as a single `items` table with the same V2 shape
  and V2 enums — `pipeline_items`, `idea_records`, and `published_records`
  are NOT split out.
- **Does not merge** `items` with `contents`. The Pipeline and the
  Distribution concept remain separate product surfaces (`Item.stage` is
  a production state, never a publishing state).
- **Does not rename** the table or its columns.
- **Does not auto-normalize** legacy data beyond what V2's existing
  migration already does.

`items` is documented as an intentional V2 carryover, kept verbatim.
Re-discussion (split / merge / retire) belongs to a future major version
that revisits the V1 Pipeline concept. V3 silently changing it would
violate the V2 invariant that Pipeline and Distribution are separate.

## Identity, workspaces, membership

- Every authenticated user has a `profiles` row (1:1 with `auth.users`)
  and exactly one **personal** workspace, created together with an
  `owner` membership by an `on_auth_user_created` Postgres trigger.
- Workspace write paths carry the `workspace_id` and rely on the canonical
  RLS policy to authorize.
- Schema is **future-ready** for shared workspaces (the
  `workspace_members.role IN ('owner', 'editor', 'viewer')` CHECK is in
  place) but the V3 product surface ships only owner-of-personal flows:
  no team management UI, no invitations, no workspace switching UI, no
  organization hierarchy, no billing, no collaboration features.
- The trigger that creates the personal workspace is the only path in V3
  that bypasses the `workspaces` RLS policy; all other workspace creation
  attempts are denied.

## Row-Level Security

The canonical membership policy is applied to every writable table that
carries `workspace_id`:

```sql
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
)
```

That single pattern gates `SELECT / INSERT / UPDATE / DELETE` on
`items`, `experiments`, `contents`, `campaigns`, `platform_contents`,
`assets`, and `asset_references`. Each table gets one `FOR SELECT` policy
(with `USING`), one `FOR INSERT` policy (with `WITH CHECK`), one `FOR
UPDATE` (with both), and one `FOR DELETE` (with `USING`).

Exceptions:

- `profiles`: `USING (auth.uid() = id)` — a user reads and edits only
  their own profile.
- `workspaces`: a user reads or updates only workspaces they are a member
  of; `FOR INSERT` is denied for the client API (workspaces are created by
  the auth trigger only).
- `workspace_members`: a user reads rows they belong to; `FOR INSERT /
  UPDATE / DELETE` are owner-gated (`role MUST be 'owner' on
  (workspace_id) to mutate'). Client cannot create memberships directly
  in V3; Phase 3 reserved.

Storage RLS on the single bucket is enforced through a per-object
`workspace_id` column set on upload and joined back to
`workspace_members` for the calling user. Application code does not
sprawl RLS logic across modules.

## Asset / storage model

One private bucket, one fixed layout:

```
velgic-assets/
  {workspace_id}/
    {asset_id}/
      filename
```

- No bucket-per-workspace. Buckets are inferred via Storage RLS.
- The V2 `StorageProvider` interface in `src/lib/storage.ts` is **not**
  changed. V2's `LocalStorageProvider` continues to ship unchanged for
  the V2 reference/back-compat path; V3 adds `SupabaseStorageProvider`
  for the new cloud path.
- The V2 asset reference string is preserved (`provider='local'` rows
  resolve through the local provider; `provider='supabase'` rows resolve
  to a short-lived signed URL).

## V2 → V3 data migration

Hard principles:

1. V2 assets are **reference-only**. There is no binary in `localStorage`
   or elsewhere to recover. Migration imports metadata + reference
   strings and preserves `provider='local'` where no binary exists.
2. The original V2 `localStorage` payload is **never deleted before the
   user verifies the imported data**. It is kept intact (read-only) and
   cleared only after explicit user confirmation.
3. Migration is **idempotent**: a `(workspace_id, asset_id)` /
   `(workspace_id, content_id)` / `(workspace_id, campaign_id)` /
   `(workspace_id, platform_content_id)` fingerprint detects already-
   imported rows and skips re-creation. Re-running is safe.
4. **Supabase Storage upload is an explicit, separate user action** —
   a manual "Upload to Velgic Cloud" affordance per asset:

   ```text
   V2 reference (provider='local')  ─→  user-initiated upload  ─→  Supabase Storage  ─→  provider='supabase'
   ```

   V3 does **not** invent or recover missing binaries.

5. **Manifests are unaffected** by migration. They remain a portable
   export/import contract validated atomically by the manifest-import RPC.

The migration flow:

1. **Discovery** — "Move your local Velgic to your new account?" →
   yes / no.
2. **Sign in / sign up** — `auth.uid()` resolves.
3. **Mapping** — every V2 entity becomes one Postgres row in the user's
   personal workspace; `provider='local'` flag is preserved.
4. **Reconciliation** — show counts side-by-side with the V2 source.
   Any divergence prompts review.
5. **Verification** — only after the user confirms are the originals
   cleared. Until then the V2 payload remains read-only in
   `localStorage`.

## API surface

The data flow:

```text
UI (pages / components)
   │
   ▼
Zustand (useStore — application state + UI cache)
   │
   ▼
Repository interface (V3 boundary)
   ├── LocalRepository   = the existing useStore  (Zustand + persist; identity-mapping)
   └── SupabaseRepository = supabase-js queries
                │
                ▼
        Supabase Postgres + Storage
        │
        └── (manifest import only) Postgres function manifest_import(...)
```

Two access tiers are explicit:

```text
1. Normal CRUD → direct supabase-js through Repository methods.
   All checks respect CHECK constraints and RLS policies.
   This is the overwhelming majority of V3 calls.

2. Transactional domain operations → narrowly scoped PostgreSQL
   function called via supabase.rpc(...).
   V3 commits to exactly one such RPC at launch: manifest_import.
```

Why no separate `OfflineAdapter` abstraction: the V2 `useStore` already
*is* the `LocalRepository`. It satisfies `VelgicRepository` by
signature. Naming a parallel abstraction on top of an already-correct
one would be indirection without benefit. The existing localStorage
implementation will remain usable throughout V3 migration as the
`LocalRepository` slot.

**The single RPC:** the server-side transaction that preserves the V2
invariant that validation failure or persistence failure never leaves a
partial manifest.

```sql
-- Phase 7 lands this; documented here for review.
CREATE OR REPLACE FUNCTION public.manifest_import(p_manifest jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER       -- RLS still applies to all writes inside.
AS $$
  -- 1. Validate p_manifest against the canonical v1.0 schema rules
  --    (the regex/IANA/CHECK checks re-expressed in PL/pgSQL so the
  --    server is the gatekeeper, not the client).
  -- 2. If issues: RETURN jsonb_build_object('issues', ...).
  -- 3. If valid: BEGIN; resolve the user's personal workspace_id;
  --    upsert ContentItem, Campaign, PlatformContent; insert/dedupe
  --    Assets; insert AssetReferences; COMMIT.
  -- 4. RETURN jsonb_build_object('issues', '[]'::jsonb, 'campaignId', ...).
$$;
```

The Repository method `importCampaign` on `SupabaseRepository` is the
only client-side caller of `supabase.rpc('manifest_import', ...)`. All
other client calls go to tables directly.

## Local development + CI

```bash
# one-time
supabase init                   # creates supabase/ folder + config.toml
supabase start                  # boots Postgres + Auth + Storage + Studio locally
supabase db reset               # applies migrations + seed after Phase 2 lands

# day-to-day
npm run dev                     # unchanged; SPA reads .env.local

# CI V2 — unchanged
npm ci
npm install --no-save --no-package-lock jsdom
npx tsc
npm test                        # 291/291 acceptance checks
npm run build
```

- `.env.local` (gitignored) carries `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`.
- `OfflineAdapter` is not introduced as a separate concept; the existing
  V2 `useStore` is the local-Runtime replacement, and Phase 1's
  `src/lib/env.ts` provides `isEnvConfigured()` so future Supabase-aware
  code paths can be gated cleanly.
- An additive V3 CI job (later phases) will boot Supabase locally via the
  CLI and run new V3 acceptance suites. The V2 CI gate stays green
  regardless.

## Environment & secrets

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Build-time env (Cloudflare Pages + `.env.local`) | Public |
| `VITE_SUPABASE_ANON_KEY` | Build-time env (Cloudflare Pages + `.env.local`) | Public; safe only because RLS gates every row |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used in V3 first cut | If a privileged server-side action ever lands (Edge Function, scheduled worker), it would live in Cloudflare Pages encrypted env or a GitHub Actions secret |
| `.env*` files | `.gitignore` — only `.env.example` committed | |
| `src/lib/env.ts` | Lazy validation | Throws with a clear message if VITE_* are missing |

## Cost model

**Supabase Free tier is the target for V3.** V3 first cut expected use:

- **Postgres** — 500 MB cap; V2 seed is ~50 KB; even at 100× under cap.
- **Storage** — 1 GB cap; V2 ships zero bytes (references only); uploaded
  assets consume storage later.
- **Egress** — 2 GB/month; signed-URL reads of small media are negligible.
- **Auth MAU** — 50,000 users; single-creator workflow is far below.

The upgrade to Pro ($25/month) is a deliberate decision triggered by:

- DB pause intervals under Free hurting the user experience.
- Storage or egress exceeding Free caps.
- A future product need (Realtime, scheduled workers, larger DB).
- Reliability/SLA expectations.

The architecture must remain operable inside the Free tier at launch.

## Source-of-truth transition

```text
V2:  localStorage(Zustand) = source of truth
                              (single user, single browser)

V3 migration window:
      Postgres    = emerging source of truth
      Zustand     = application state + UI cache
      localStorage = kept read-only until user verifies

V3 final:
      Postgres    = authoritative persistence
      Zustand     = application state + UI cache
      localStorage = holds Supabase session only
```

Zustand is preserved.

## Invariants carried forward from V2

These V2 invariants are explicitly re-asserted in V3:

1. **Content does not require an Experiment.** `ContentItem` may carry
   `linkedExperimentId = null`; creating content from any of eight
   origins (`idea / experiment / research / observation / opinion /
   trend / personal_experience / direct`) is first-class.
2. **Production Pipeline and Distribution are separate.** `Item.stage`
   (`ideas → research → script → production → published`) is a
   production workflow. Distribution status lives on
   `ContentItem.status`, `Campaign.status`, and
   `PlatformContent.status` — independent axes that may legitimately
   carry different states for the same work.
3. **Platform-specific metadata is not flattened.** Each platform keeps
   its own `instagram | youtube | linkedin | x` shape (jsonb), not a
   generic metadata blob.
4. **V2 `Campaign.platforms` is a derived mirror.** Postgres carries
   the source of truth (`platform_contents.platform`); the application
   rebuilds the V2 mirror on read.
5. **Assets are references.** No binary media is ever embedded in JSON or
   in the manifest. `StorageProvider` interface stays stable at the
   application layer; only the implementation classes change.
6. **Manifest v1.0 is unchanged.** Database and Manifest are separate
   contracts. The schema evolves; the manifest does not. A future
   manifest `1.1`/`2.0` is additive.
7. **The four independent statuses.** Pipeline, Content, Publish (per
   platform version), and Campaign are encoded on different rows and
   cannot be merged.
8. **Deletions cascade.** Deleting a Content cascades to its campaigns
   and their platform versions; deleting a campaign cascades to its
   platform versions; deleting an asset is blocked while referenced.
9. **Reference-only assets are exactly what V2 declared.** No binary
   embedding, no `StorageProvider` change at the interface level.

## Risks & trade-offs

| Risk | Mitigation |
|---|---|
| RLS misconfiguration leaks rows across workspaces | `acceptance-v3-rls.ts` test suite against a local Supabase: "user A cannot read user B's rows." |
| `VITE_SUPABASE_*` missing breaks V2 dev | `src/lib/env.ts` lazy validation; V2 module graph never imports V3 paths; tests use the V2 store only. |
| Free-tier DB pause creates a perceived outage | V2's full feature set runs without Supabase; only multi-device sync is affected by a pause. Upgrade documentation is explicit. |
| Manifest v1.0 drift | Manifest remains derived purely from V2 types; database does not own manifest-shape fields; the RPC validates against the canonical schema embeds. |
| `Item` silently conflated with `ContentItem` | `items` shape preserved verbatim; Pipeline-vs-Distribution invariant documented and tracked in DB-level CHECK constraints. |
| `campaigns.platforms text[]` divergence with `platform_contents.platform` | Column removed from canonical schema; the application derives the V2 mirror exclusively from platform versions. |
| RPC atomicity gap on multi-row writes outside `manifest_import` | Documented as the only RPC at V3 launch; Phase 7 introduces only this one. Future RPC additions are reviewed against the "transactional-only" rule. |
| Idempotency drift on repeat migration | Fingerprints (`(workspace_id, asset_id)` etc.) make re-runs safe; reconciliation UI surfaces count drift before the user confirms deletion of the V2 payload. |
| Asset-references integrity under concurrent edits | Unique constraints and PK invariants; asset-based transactions inside `manifest_import` are wrapped in `BEGIN/COMMIT` with retry-on-conflict the caller's responsibility. |

## Phased rollout

The phases deliberately add one feature at a time. V2 acceptance tests,
`npx tsc`, and `npm run build` remain green throughout. New V3 acceptance
suites layer on top — never replacing V2.

**Phase 0 — Architecture sign-off.** This document.
**Status:** ✅ Approved.

**Phase 1 — Local foundation only.**

- ✅ `docs/architecture-v3.md` written and merged.
- ✅ Supabase CLI configuration (`supabase init`, `supabase/config.toml`).
- ✅ `.env.example` committed; `.env*` gitignored.
- ✅ `src/lib/env.ts` startup validation.
- ✅ `src/lib/api/supabase.ts` typed client instantiation (lazy).
- ✅ `src/lib/repo/types.ts` type-only Repository declaration.
- ✅ `supabase/migrations/` folder structure (empty: Phase 2 fills it).
- V2's `npm test`, `npx tsc`, `npm run build` remain green.
- No auth UI, no SQL migrations, no storage writes, no realtime, no AI,
  no social APIs.

**Phase 2 — Schema migrations + RLS + seed.** SQL files for the ten
tables; CHECK constraints from V2 enums; canonical membership policy;
profiles/workspace_members exceptions; idempotent seed mirroring the V2
`src/data/seed.ts` payload.

**Phase 3 — Auth + workspace bootstrap.** Minimal sign-in / sign-up
screen; `on_auth_user_created` Postgres trigger creates the personal
workspace and the owner membership in one transaction.

**Phase 4 — Repository: `SupabaseRepository`.**
`src/lib/repo/supabaseRepository.ts` matching
`src/lib/repo/types.ts`. Direct supabase-js CRUD through the Repository
interface; pages opt in to SupabaseRepository as features ship.

**Phase 5 — Storage adapter.**
`SupabaseStorageProvider` implements `StorageProvider`; explicit
user-initiated upload flow converts `provider='local'` →
`provider='supabase'`.

**Phase 6 — Migration tool.** Reference-only, idempotent, reconciliation
UI, never deletes the legacy V2 payload before user verification.

**Phase 7 — Manifest-import RPC + adapter wiring.** SQL migration with
the `manifest_import(jsonb)` PL/pgSQL function (SECURITY INVOKER,
validation re-expressed server-side, atomic INSERT/UPSERT inside one
transaction). The only V3 RPC at launch. Acceptance gate: the 13-issue
matrix from V2's 141-check suite passes against RPC-validated imports.

## What is intentionally NOT in V3 (documented future extensions)

- **Realtime subscriptions, collaborative cursors, Kanban realtime.** No
  V3 dependency on Supabase Realtime.
- **Bucket-per-workspace.** Single `velgic-assets` bucket; RLS enforces
  per-(workspace) isolation.
- **Server-side manifest validation as a separate service.** Keep the
  validation logic where V2 already has it (`src/lib/manifest.ts`) and
  re-express it in PL/pgSQL only for the transactional RPC. No
  standalone validator microservice.
- **Automatic binary media migration.** V2 assets are references; V3 only
  uploads when the user explicitly initiates it.
- **A custom REST / API server.** Everything goes through `supabase-js`.
- **Social platform APIs (publishing, scheduling to Instagram/YouTube/
  LinkedIn/X).** Publishing remains the manual, copy-paste workflow from
  V2.
- **Edge Functions** (except as needed by future phases; not at launch).
- **Background workers / scheduled jobs.** None.
- **AI providers, real or mock.** The V2 copy-paste prompt workflow
  continues as-is.
- **Shared workspaces UI, team management, invitations, organization
  hierarchy, billing UI, collaboration.** Schema is ready; product
  surface is personal-workspace-only.
- **`published_urls`, `dismissed`, `migration_state` audit tables.**
  Schema is intentionally minimal; tables are added in later phases if a
  real need surfaces.
- **Ad-hoc RPCs** beyond `manifest_import`. The narrow RPC rule applies
  to anything new.
