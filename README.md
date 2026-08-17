# Velgic

**Velgic — AI-powered Creator & Content Intelligence OS.** A local-first tool for a technical creator that takes you from **idea → experiment → content → publishing → learning**.

Dark, professional, developer-grade UI. 100% client-side. **Velgic 2.x is
complete and verified: 291/291 acceptance checks passing, `npx tsc` and
`npm run build` both pass.**

## What Velgic is

Velgic is organized in four layers (full architecture:
[`docs/architecture-2x.md`](docs/architecture-2x.md)):

```text
Decision
├── Ideas
└── Experiments

Production
└── Pipeline (Ideas → Research → Script → Production → Published)

Distribution
├── Content
├── Campaigns
├── Platform Versions
└── Assets

Publishing
├── Manifest v1.0
├── Validation
└── Manual Publishing Preparation
```

The complete manual distribution workflow:

```text
Idea / Experiment / Direct Content → Content → Campaign → Platform Versions
→ Assets → Publishing Manifest → Validation → Ready / Scheduled → Published → Insights
```

Content does **not** require an experiment. Pipeline status and publishing status
are separate concepts — the Pipeline is the production workflow, and
content/campaign/platform statuses are distribution concepts.

## Stack

- **React 18 + TypeScript** (Vite)
- **React Router** (hash-based, no server rewrites needed)
- **Zustand** with `persist` — everything you edit is saved to `localStorage`
- **Plain CSS** design system (no UI framework) with CSS variables / design tokens

## What Velgic does

### Ideas

- **Idea Inbox** — capture ideas with category, audience, format, effort, impact,
  status, and notes; score each idea 1–10 across *audience value*, *novelty*,
  *personal relevance*, and *ease of execution* for a computed opportunity score
  (0–40).
- **Recommendation engine** — "What should I build next?" with opportunity score,
  reasoning, Start experiment / Create content / Dismiss, and Quick Capture.
  `Opportunity Score = Audience Value + Novelty + Personal Relevance + Ease of
  Execution`, with a `+4` bonus for ideas reusable across formats.

### Experiments

- **Experiment Log** — hypothesis, what was built, tools, time spent, result,
  metrics, what worked/failed, key learning, and follow-up idea — framed as
  learning records, not vanity metrics.
- An experiment can lead to Content (⚡), but is never required for it.

### Content

- A first-class sidebar section. A content item has title, concept, origin
  (idea / experiment / research / observation / opinion / trend / personal
  experience / direct), audience, content type (Reel, Carousel, Short video,
  LinkedIn post, X post, X thread, YouTube Short, YouTube video, Article,
  Tutorial), format, hook, draft, notes, status
  (**Draft → In Production → Ready → Published → Archived**, independent of the
  Pipeline stages), and optional links to an idea or experiment.
- Content is creatable directly, from any idea, or from any experiment.

### Campaigns

One content concept becomes a multi-platform campaign:

```text
Top Open Source Alternatives
├── Instagram → Reel    (asset, caption, hashtags, location)
├── YouTube   → Short   (video + thumbnail assets, title, description, tags)
├── LinkedIn  → Post    (post text, media)
└── X         → Thread  (post/thread content, media)
```

Campaign status (**Draft → Ready → Partially Published → Published →
Archived**) is manually set or derived from the platform versions. The campaign
page shows a distribution status summary with per-platform statuses first
(✓/○/✗ glyphs); the readiness percentage is secondary.

### Platform versions

Independently editable and independently publishable, with mixed statuses the
norm (Instagram Published, YouTube Scheduled, LinkedIn Ready, X Draft).
Statuses: **Draft → Ready → Scheduled → Published → Failed**. Each version
carries platform-specific metadata (never flattened), asset references, schedule
(enabled + ISO 8601 datetime + optional IANA timezone — metadata only, nothing
is auto-posted), published URL, published timestamp, notes, and optional manual
metrics (views/likes/comments/shares/saves) retained for future Insights.

**Currently supported platforms: Instagram, YouTube, LinkedIn, X.**

### Reusable asset references

A reference-only **asset library** — canonical fields `asset_id`, `filename`,
`type` (video / image / audio / document / link), `reference`, `provider`,
`role` (video / thumbnail / media / null), `mimeType`, `size`, `duration`, plus
library-level `createdAt` and `notes`. The same asset can be referenced by many
platform versions across campaigns; edits propagate to every usage; usage is
visible in the UI; referenced assets cannot be deleted. **No binary media is
ever stored** — references are resolved behind a `StorageProvider` abstraction
(local in 2.x; Google Drive / Cloudflare R2 are future providers, not
implemented). See `src/lib/storage.ts`.

### Velgic Publishing Manifest v1.0

The stable technical contract — canonical JSON (`"schema_version": "1.0"`,
versioned for future `1.1`/`2.0`) describing campaign, content, platforms,
platform-specific metadata, asset references, scheduling, publishing status,
published URLs/timestamps, and notes. Full schema:
[`docs/velgic-publishing-manifest.md`](docs/velgic-publishing-manifest.md).

- **Export** — download `.json` or **Copy JSON**; exported JSON always validates
  against the canonical schema.
- **Import** — paste JSON or upload `.json`; validated atomically (nothing is
  ever partially imported) with error codes + JSON paths + human-readable
  messages.

### Manifest validation

13 validation codes, each with a JSON path and message: `INVALID_JSON`,
`UNSUPPORTED_SCHEMA_VERSION`, `MISSING_CAMPAIGN`, `MISSING_PLATFORM`,
`MISSING_REQUIRED_METADATA`, `INVALID_DATETIME`, `INVALID_PLATFORM_FORMAT`
(case-insensitive format matching, normalized to canonical case),
`INVALID_ASSET_REFERENCE` (type + role + reference), `INVALID_STATUS`,
`INVALID_CONTENT_TYPE`, `INVALID_PUBLISHED_URL`, `INVALID_TIMEZONE`,
`INVALID_METADATA`. Invalid manifests are rejected atomically — never partially
imported.

### External-AI prompt workflow (AI optional)

Velgic **never calls an AI API**. **Generate AI prompt** packages the content,
campaign, platforms, formats, assets (complete fields + exact ISO 8601
datetimes — validated by the external-AI round-trip test), current metadata,
schedules, brand placeholders, the complete schema, and 12 strict JSON-output
rules (JSON only, no fences, no explanations, no invented assets/URLs/dates,
`null` for optionals, preserve asset references, follow the schema exactly,
preserve factual/user-provided information). Copy it into ChatGPT / Gemini /
Claude / Grok / any AI tool, then import the returned `metadata.json` — Velgic
defines the contract and validates the result. Everything remains fully manually
editable.

### Manual publishing preparation

Per platform: Edit, Copy content, Copy caption, Copy title + Copy description
(YouTube), Export manifest, Open platform, Mark Ready / Scheduled / Published,
Add Published URL, Add/Edit Published timestamp. The lifecycle
**Draft → Ready → Scheduled → Published → Failed** is fully manual —
scheduling is metadata only; Velgic does not post to social networks.

### The existing product (preserved, unchanged)

- **Dashboard** — recommendation engine, content-pipeline summary, quick
  capture, recent experiments, content status, recent content.
- **Content Pipeline** — a drag-and-drop Kanban board (Ideas → Research →
  Script → Production → Published). This remains the **production workflow**.
- **Content Detail** — per-item sections (core idea, hook, audience problem, key
  insight, script, visual plan, production notes, publishing checklist,
  performance, lessons learned) plus one-click mock AI generation for hooks,
  short-form scripts, visual plans, LinkedIn posts, and Instagram captions.
- **Insights** — best topics, best formats, best hooks, average performance,
  experiments worth repeating, and underperforming topics (simple charts only).

## Persistence

**Zustand + localStorage** (persist v3 with migrations). Everything survives
refresh: content, campaigns, platform versions, assets, publishing statuses,
published URLs, schedules, timestamps, metrics. Existing V1 data structures are
migrated in place, never discarded.

## What V2 does NOT require

- ❌ No **AI APIs** (the `MockAiProvider` works offline; publishing uses the
  external prompt workflow)
- ❌ No **social APIs** (publishing is fully manual; scheduling is metadata only)
- ❌ No **database** (localStorage only)
- ❌ No **authentication** (single-user, browser-local)
- ❌ No **Google Drive** integration
- ❌ No **Cloudflare R2** integration
- ❌ No **background workers**

`AiProvider` and `StorageProvider` are intentional extension points for the
future; their external implementations are **not** part of 2.x.

## Current limitations

- Single browser / single user — data lives in localStorage and is not synced.
- Assets are references only — there is no file upload or hosting.
- Publishing is manual: no posting or scheduling via platform APIs.
- No AI calls from the app; AI assistance is copy-paste via the prompt workflow.
- Analytics metrics are manually entered; nothing is ingested automatically.
- Mock AI only for the legacy content-generation buttons.

## Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```

## Acceptance tests

Repeatable headless acceptance suites live in `scripts/` (run instructions in
each file header):

- `acceptance-publishing-manifest.ts` — **141/141**: content → campaign →
  platforms → prompt → import → validate → export → persistence, with 16
  invalid-manifest cases.
- `acceptance-ai-roundtrip.ts` — **82/82**: simulated external AI consuming the
  exact generated prompt, round-tripping the JSON through import/validation.
- `acceptance-2x-final.ts` — **68/68**: asset library (reuse, usage, deletion
  protection), publishing preparation actions, validation hardening, V1
  regression.

Total: **291/291 checks pass**. `npx tsc` PASS · `npm run build` PASS.

Data lives in `src/data/seed.ts` (realistic seeded examples: 8 ideas, 5 pipeline
items, 5 published records, 4 experiments, 4 content pieces, 4 campaigns, 14
platform versions, and the asset library — including the end-to-end test case
*Top open-source alternatives for content creators* distributed as Instagram
Reel, YouTube Short, LinkedIn Post, and X Thread with independent statuses).
Use **Reset demo data** in the sidebar to restore the seed.

## Intentionally deferred to V3 (not implemented)

Real AI-provider integration, social-media publishing APIs, automatic analytics
ingestion, Google Drive / Cloudflare R2 storage providers, authentication,
database, background workers.
