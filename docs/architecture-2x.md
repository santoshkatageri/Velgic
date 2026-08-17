# Velgic 2.x — Architecture (Authoritative)

Velgic 2.x is a **client-side, local-first** creator operating system. Everything
runs on **Zustand + localStorage** — no paid AI API, no social-media APIs, no
authentication, no database, no Google Drive, no Cloudflare R2, no background
workers.

**Velgic 2.x is complete.** Verified state:

- Publishing Manifest acceptance: **141/141**
- External-AI round-trip acceptance: **82/82**
- Final 2.x acceptance: **68/68**
- Total: **291/291** checks passing (`scripts/`)
- `npx tsc` PASS · `npm run build` PASS

## The four layers

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

## The complete manual distribution workflow

```text
Idea / Experiment / Direct Content
              ↓
           Content
              ↓
          Campaign
              ↓
      Platform Versions
              ↓
            Assets
              ↓
    Publishing Manifest
              ↓
         Validation
              ↓
      Ready / Scheduled
              ↓
          Published
              ↓
           Insights
```

---

## Entity relationships (explicit)

- **Content is independent of Experiments.** Creating content never requires an
  experiment — a simple Reel, post, or thread goes straight from concept to
  campaign.
- **An Idea or an Experiment can lead to Content** (via the ⚡ "Create content"
  action), and the resulting Content keeps an optional link
  (`linkedIdeaId` / `linkedExperimentId`) back to it.
- **Content can also be created directly** from the Content section, with any of
  eight origins: `idea`, `experiment`, `research`, `observation`, `opinion`,
  `trend`, `personal_experience`, `direct`.
- **The existing Pipeline is a production workflow.** It remains exactly
  `Ideas → Research → Script → Production → Published` and is not part of the
  distribution model.
- **Publishing status is separate from Pipeline status.** Content
  (`Draft → In Production → Ready → Published → Archived`), Campaign
  (`Draft → Ready → Partially Published → Published → Archived`), and Platform
  version (`Draft → Ready → Scheduled → Published → Failed`) statuses are
  distribution concepts. Both systems may legitimately hold different states for
  the same underlying work.
- **A Campaign represents one content concept distributed across multiple
  platforms.** A Content item can have one or more campaigns; each campaign
  holds independent platform versions.
- **Platform versions are independently editable and independently
  publishable.** Mixed statuses are the norm (Instagram Published, YouTube
  Scheduled, LinkedIn Ready, X Draft).
- **Assets are references, not binary files.** No binary media is ever stored in
  localStorage or embedded in the manifest.
- **Zustand + localStorage is the V2 persistence mechanism** (persist v3 with
  migrations). Everything — content, campaigns, platform versions, assets,
  publishing statuses, published URLs, schedules, timestamps, metrics — survives
  a refresh. Existing V1 data structures are migrated in place, never discarded.

---

## 1. Content

First-class entity, creatable independently. Fields: id, title, concept, origin
(eight origins above), audience, content type (Reel, Carousel, Short video,
LinkedIn post, X post, X thread, YouTube Short, YouTube video, Article,
Tutorial), format, hook, draft, notes, status, createdAt, updatedAt, optional
`linkedIdeaId` / `linkedExperimentId`.

Statuses: `Draft → In Production → Ready → Published → Archived`.

## 2. Campaigns

One content concept distributed across platforms. Fields: id, contentId, name,
description, status, createdAt, updatedAt (+ a derived `platforms[]` mirror).

Statuses: `Draft → Ready → Partially Published → Published → Archived` — set
manually or derived from the platform versions (all published → Published, any
published → Partially Published, all ready → Ready, otherwise Draft). The
campaign page shows a **distribution status summary** with per-platform statuses
first (✓/○/✗ glyphs); the readiness percentage is secondary information only.

## 3. Platform versions

Independently editable and independently publishable. Statuses:
`Draft → Ready → Scheduled → Published → Failed`.

Supported platforms: **Instagram, YouTube, LinkedIn, X.**

Per-platform, non-flattened metadata:

| Platform   | Formats              | Metadata                                        |
| ---------- | -------------------- | ----------------------------------------------- |
| Instagram  | Reel, Carousel, Post | caption, hashtags, location                     |
| YouTube    | Short, Video         | title, description, tags, thumbnail reference   |
| LinkedIn   | Post, Article        | post_text, media references                     |
| X          | Post, Thread         | content, is_thread, thread[]                    |

Each version also carries: format, assets, schedule (`enabled` + ISO 8601
`datetime` + optional IANA `timezone` — metadata only, nothing is auto-posted),
publishedUrl, publishedAt, notes, and optional manual `metrics`
(views/likes/comments/shares/saves) retained for future Insights.

## 4. Assets

**Reference-only.** No binary media is ever stored in localStorage or the
manifest. Canonical fields: `asset_id`, `filename`, `type`
(`video | image | audio | document | link`), `reference` (a path resolved by the
active StorageProvider), `provider`, `role`
(`video | thumbnail | media | null`), `mimeType`, `size`, `duration` — plus
library-level `createdAt` and `notes` (app-level, outside the manifest).

Assets live in a **reusable asset library**: a platform version can attach a
library asset (or create a new one), the same asset can be referenced by many
platform versions across campaigns, edits to a shared asset propagate to every
usage, usage is visible in the UI, and deletion is blocked while an asset is
referenced. Imports deduplicate by `asset_id` + `reference` and uniquify
colliding ids.

## 5. Publishing Manifest v1.0

The stable technical contract between Velgic, external AI tools, assets, and
future publishing providers. Canonical JSON with `"schema_version": "1.0"`,
versioned for future `1.1`/`2.0` via `SUPPORTED_SCHEMA_VERSIONS`.

Represented: schema version, manifest id, generated timestamp, timezone, brand
information, campaign, content, platforms, platform-specific metadata, asset
references, schedule, publishing status, published URLs, published timestamps,
notes.

Full schema: [`docs/velgic-publishing-manifest.md`](velgic-publishing-manifest.md).

### Validation

Atomic — invalid manifests are never partially imported. Error codes carry a
JSON path and a human-readable message:

`INVALID_JSON`, `UNSUPPORTED_SCHEMA_VERSION`, `MISSING_CAMPAIGN`,
`MISSING_PLATFORM`, `MISSING_REQUIRED_METADATA`, `INVALID_DATETIME`,
`INVALID_PLATFORM_FORMAT` (case-insensitive format matching, normalized to
canonical case on import), `INVALID_ASSET_REFERENCE` (type + role + reference),
`INVALID_STATUS`, `INVALID_CONTENT_TYPE`, `INVALID_PUBLISHED_URL`,
`INVALID_TIMEZONE`, `INVALID_METADATA`.

### Import / Export

- **Import** — paste JSON or upload `.json` → validate → import only when fully
  valid. Ids are preserved when unique; colliding ids are uniquified; assets are
  registered in the library; linked idea/experiment ids are resolved only when
  they exist locally.
- **Export** — download `.json` or **Copy JSON**; exported JSON always validates
  against the canonical v1.0 schema.

## 6. Manual publishing preparation

Each platform version supports the full manual lifecycle:

- Actions: Edit (inline), Copy content, Copy caption, Copy title + Copy
  description (YouTube), Export manifest, Open platform, Mark Ready / Mark
  Scheduled / Mark Published, Add Published URL, Add/Edit Published timestamp.
- "Mark scheduled" enables the schedule with a default datetime if none is set;
  "Mark published" auto-sets the published timestamp (editable afterwards).
- Scheduling is **metadata only** in 2.x — Velgic does not automatically publish
  or schedule through social APIs.

## 7. External-AI prompt workflow (AI optional)

Velgic **never calls an AI API**. The workflow is:

```text
Velgic
 ↓
Generate Publishing Prompt  (content + campaign + platforms + formats + assets
 ↓                          + current metadata + schedules + brand + schema + rules)
ChatGPT / Gemini / Claude / Grok / any AI tool
 ↓
metadata.json
 ↓
Import
 ↓
Validate
 ↓
Publishing package
```

The prompt embeds exact ISO 8601 datetimes and complete asset fields (validated
by the external-AI round-trip test) plus 12 strict output rules: JSON only, no
markdown fences, no explanations, no invented assets/URLs/dates, `null` for
unavailable optionals, preserve asset references, ISO 8601 datetimes, follow the
Velgic schema exactly, and preserve factual/user-provided information. The AI is
never required — everything remains manually editable.

## 8. Persistence

Zustand + localStorage (persist v3 with migrations). Everything survives
refresh: content, campaigns, platform versions, assets, publishing statuses,
published URLs, schedules, timestamps, metrics. Existing V1 data structures are
migrated in place, never discarded.

## 9. Extension points (interfaces only — external providers NOT implemented)

- **`AiProvider`** (`src/lib/ai.ts`) — one `complete(prompt, context)` method.
  V2 ships only the `MockAiProvider`; the publishing workflow uses the external
  prompt instead. A real model could be plugged in via `configureProvider(...)`
  in the future. **No real AI provider is implemented in 2.x.**
- **`StorageProvider`** (`src/lib/storage.ts`) — `resolve(reference)` +
  `validateReference(reference)`. V2 ships only the local/reference provider.
  Google Drive and Cloudflare R2 are **future** providers behind this same
  interface. **They are not implemented in 2.x.**

```text
AiProvider
├── MockAiProvider (2.x — implemented)
└── Real model (future — not implemented)

StorageProvider
├── Local / Reference (2.x — implemented)
├── Google Drive (future — not implemented)
└── Cloudflare R2 (future — not implemented)
```

## 10. Intentionally deferred to V3 (not implemented)

- Real AI-provider integration
- Social-media publishing APIs (scheduling stays metadata only)
- Automatic analytics ingestion
- Google Drive / Cloudflare R2 storage providers
- Authentication, database, background workers
