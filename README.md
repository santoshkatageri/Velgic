# Velgic

**Velgic — AI-powered Creator & Content Intelligence OS.** A local-first tool for a technical creator that takes you from **idea → experiment → content → publishing → learning**.

Dark, professional, developer-grade UI. 100% client-side: no paid AI API, no
social-media APIs, no authentication, no database, no cloud storage, no
background workers.

## Stack

- **React 18 + TypeScript** (Vite)
- **React Router** (hash-based, no server rewrites needed)
- **Zustand** with `persist` — everything you edit is saved to `localStorage`
- **Plain CSS** design system (no UI framework) with CSS variables / design tokens

## The 2.x architecture

Velgic 2.x is organized in four layers — see
[`docs/architecture-2x.md`](docs/architecture-2x.md) for the full write-up:

```text
Decision
├── Ideas
└── Experiments

Production
└── Existing Pipeline (Ideas → Research → Script → Production → Published)

Distribution
├── Content
├── Campaigns
├── Platform Versions
├── Assets
├── Publishing Manifest
├── Validation
└── Publishing Preparation

Publishing
└── Velgic Manifest 1.0 + Validation + Manual Publishing
```

The complete manual distribution workflow:

```text
Idea / Experiment / Direct Content → Content → Campaign → Platform Versions
→ Assets → Publishing Manifest → Validation → Ready / Scheduled → Published → Insights
```

Content does **not** require an experiment. Pipeline status and publishing status
are separate concepts — the production Pipeline is the production workflow, and
content/campaign/platform statuses are distribution concepts.

## V1 — the existing product (preserved, unchanged)

- **Dashboard** — "What should I build next?" recommendation engine (opportunity score + reasoning + Start experiment / Create content / Dismiss), content-pipeline summary, quick capture, recent experiments, content status, recent content.
- **Idea Inbox** — capture ideas with category, audience, format, effort, impact, status, and notes; score each idea 1–10 across *audience value*, *novelty*, *personal relevance*, and *ease of execution* for a computed opportunity score (0–40).
- **Content Pipeline** — a drag-and-drop Kanban board (Ideas → Research → Script → Production → Published). This remains the **production workflow**.
- **Content Detail** — per-item sections (core idea, hook, audience problem, key insight, script, visual plan, production notes, publishing checklist, performance, lessons learned) plus one-click mock AI generation for hooks, short-form scripts, visual plans, LinkedIn posts, and Instagram captions.
- **Experiment Log** — hypothesis, what was built, tools, time spent, result, metrics, what worked/failed, key learning, and follow-up idea — framed as learning records, not vanity metrics.
- **Insights** — best topics, best formats, best hooks, average performance, experiments worth repeating, and underperforming topics (simple charts only).

## V2 — Content + Multi-platform Publishing

- **Content** — a first-class section in the sidebar. A content item has title,
  concept, origin (idea / experiment / research / observation / opinion / trend /
  personal experience / direct), audience, content type (Reel, Carousel, Short
  video, LinkedIn post, X post, X thread, YouTube Short, YouTube video, Article,
  Tutorial), format, hook, draft, notes, status
  (**Draft → In Production → Ready → Published → Archived**, independent of the
  Pipeline stages), and optional links to an idea or experiment. Content can be
  created directly from the Content section, from any idea, or from any
  experiment.
- **Campaigns** — one content concept becomes a multi-platform campaign:

  ```text
  Top Open Source Alternatives
  ├── Instagram → Reel    (asset, caption, hashtags, location)
  ├── YouTube   → Short   (video + thumbnail assets, title, description, tags)
  ├── LinkedIn  → Post    (post text, media)
  └── X         → Thread  (post/thread content, media)
  ```

  Campaign status (**Draft → Ready → Partially Published → Published →
  Archived**) is manually set or derived from the platform versions. The
  campaign page shows a **distribution status summary** with per-platform
  statuses first (✓/○/✗ glyphs); the readiness percentage is secondary.
- **Platform versions** — independently editable and independently publishable.
  Mixed statuses are the norm (Instagram Published, YouTube Scheduled, LinkedIn
  Ready, X Draft). Statuses: **Draft → Ready → Scheduled → Published → Failed**.
  Each version carries platform-specific metadata (never flattened), asset
  references, schedule (enabled + ISO 8601 datetime + optional IANA timezone —
  metadata only, nothing is auto-posted), published URL, published timestamp,
  notes, and optional manual metrics (views/likes/comments/shares/saves)
  retained for future Insights.
- **Assets** — a reusable, reference-only **asset library**. Canonical fields:
  `asset_id`, `filename`, `type` (video / image / audio / document / link),
  `reference`, `provider`, `role` (video / thumbnail / media / null),
  `mimeType`, `size`, `duration`, plus library-level `createdAt` and `notes`.
  The same asset can be referenced by multiple platform versions across
  campaigns; edits propagate to every usage; usage is visible in the UI; and
  referenced assets cannot be deleted. **No binary media is ever stored** —
  references are resolved behind a `StorageProvider` abstraction (local in 2.x;
  Google Drive / Cloudflare R2 later). See `src/lib/storage.ts`.
- **Velgic Publishing Manifest v1.0** — the stable technical contract. Canonical
  JSON (`"schema_version": "1.0"`, versioned for future `1.1`/`2.0`) describing
  campaign, content, platforms, platform-specific metadata, asset references,
  scheduling, publishing status, published URLs/timestamps, and notes.
  - **Export** — download `.json` or **Copy JSON**; exported JSON always
    validates against the canonical schema.
  - **Import** — paste JSON or upload `.json`; validated atomically (nothing is
    ever partially imported) with error codes + JSON paths + human-readable
    messages: `INVALID_JSON`, `UNSUPPORTED_SCHEMA_VERSION`, `MISSING_CAMPAIGN`,
    `MISSING_PLATFORM`, `MISSING_REQUIRED_METADATA`, `INVALID_DATETIME`,
    `INVALID_PLATFORM_FORMAT`, `INVALID_ASSET_REFERENCE`, `INVALID_STATUS`,
    `INVALID_CONTENT_TYPE`, `INVALID_PUBLISHED_URL`, `INVALID_TIMEZONE`,
    `INVALID_METADATA`.
  - Full schema: [`docs/velgic-publishing-manifest.md`](docs/velgic-publishing-manifest.md).
- **Publishing preparation** — manual publishing workflow per platform: Edit,
  Copy content, Copy caption, Copy title + Copy description (YouTube), Export
  manifest, Open platform, Mark Ready / Scheduled / Published, Add Published
  URL, Add/Edit Published timestamp. Scheduling is metadata only in 2.x — no
  social APIs, no automatic posting.
- **External AI prompt workflow (AI optional)** — Velgic never calls an AI API.
  **Generate AI prompt** packages the content, campaign, platforms, formats,
  assets, current metadata, schedules, brand placeholders, the complete schema,
  and strict JSON-output rules (JSON only, no fences, no explanations, no
  invented assets/URLs/dates, `null` for optionals, preserve asset references,
  ISO 8601 datetimes, follow the schema exactly, preserve factual/user-provided
  information). Copy it into ChatGPT / Gemini / Claude / Grok / any AI tool,
  then import the returned `metadata.json` — Velgic defines the contract and
  validates the result. Everything remains fully manually editable.

## Recommendation engine

```text
Opportunity Score = Audience Value + Novelty + Personal Relevance + Ease of Execution
```

Ideas marked **"Reusable across multiple formats"** get a `+4` bonus. The engine explains its reasoning, not just a number.

## AI integration

The app ships with a `MockAiProvider` (`src/lib/ai.ts`) so everything works offline. To connect a real model, implement the `AiProvider` interface and call `configureProvider(...)` once — no UI changes required. The publishing workflow intentionally uses the **external AI prompt** approach instead: Velgic generates the prompt, you run it anywhere, and import the JSON. **No AI API is required for anything.**

## Run it

```bash
npm install
npm run dev      # start the dev server
npm run build    # type-check + production build
```

## Acceptance tests

Repeatable headless acceptance suites live in `scripts/` (run instructions in
each file header):

- `acceptance-publishing-manifest.ts` — 141 checks: content → campaign →
  platforms → prompt → import → validate → export → persistence, with 15
  invalid-manifest cases.
- `acceptance-ai-roundtrip.ts` — 82 checks: simulated external AI consuming the
  exact generated prompt, round-tripping the JSON through import/validation.
- `acceptance-2x-final.ts` — 68 checks: asset library (reuse, usage, deletion
  protection), publishing preparation actions, validation hardening, V1
  regression.

Data lives in `src/data/seed.ts` (realistic seeded examples: 8 ideas, 5 pipeline
items, 5 published records, 4 experiments, 4 content pieces, 4 campaigns, 14
platform versions, and the asset library — including the end-to-end test case
*Top open-source alternatives for content creators* distributed as Instagram
Reel, YouTube Short, LinkedIn Post, and X Thread with independent statuses).
Use **Reset demo data** in the sidebar to restore the seed.

## Intentionally deferred to V3

Real AI-provider integration, social-media publishing APIs, automatic analytics
ingestion, Google Drive / Cloudflare R2 providers, authentication, database,
background workers.
