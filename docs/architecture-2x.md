# Velgic 2.x — Final Architecture

Velgic 2.x is a **client-side, local-first** creator operating system. Everything
runs on **Zustand + localStorage** — no paid AI API, no social-media APIs, no
authentication, no database, no Google Drive, no Cloudflare R2, no background
workers.

The product is organized in four layers:

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

Content does **not** require an experiment. Pipeline status and publishing status
are separate concepts — the production Pipeline
(Ideas → Research → Script → Production → Published) is unchanged, while
content/campaign/platform statuses are distribution concepts.

---

## 1. Content

First-class entity, creatable independently. Origins: `idea`, `experiment`,
`research`, `observation`, `opinion`, `trend`, `personal_experience`, `direct`.
Optional `linkedIdeaId` / `linkedExperimentId`.

Statuses: `Draft → In Production → Ready → Published → Archived`.

## 2. Campaigns

One content concept distributed across platforms. Fields: id, contentId, name,
description, status, createdAt, updatedAt (+ a derived `platforms[]` mirror).

Statuses: `Draft → Ready → Partially Published → Published → Archived` — set
manually or derived from the platform versions (all published → Published, any
published → Partially Published, all ready → Ready, otherwise Draft). The UI
shows the per-platform statuses first (with ✓/○/✗ glyphs); the readiness
percentage is secondary information only.

## 3. Platform versions

Independently editable and independently publishable — mixed statuses are the
norm:

```text
Instagram → Published
YouTube   → Scheduled
LinkedIn  → Ready
X         → Draft
```

Statuses: `Draft → Ready → Scheduled → Published → Failed`.

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

Publishing preparation actions per platform: Edit (inline), Copy content,
Copy caption, Copy title + Copy description (YouTube), Export manifest,
Open platform, Mark Ready / Scheduled / Published, Add Published URL,
Add/Edit Published timestamp.

## 4. Assets

**Reference-only.** No binary media is ever stored in localStorage or the
manifest. Canonical fields: `asset_id`, `filename`, `type`
(`video | image | audio | document | link`), `reference` (a path resolved by the
active StorageProvider), `provider`, `role`
(`video | thumbnail | media | null`), `mimeType`, `size`, `duration` — plus
library-level `createdAt` and `notes`.

Assets live in a **reusable asset library**: a platform version can attach a
library asset (or create a new one), the same asset can be referenced by many
platform versions across campaigns, edits to a shared asset propagate to every
usage, usage is visible in the UI, and deletion is blocked while an asset is
referenced.

```text
StorageProvider
├── Local / Reference (2.x — implemented)
├── Google Drive (future)
└── Cloudflare R2 (future)
```

The abstraction (`src/lib/storage.ts`) is ready for remote providers; 2.x does
not integrate them.

## 5. Velgic Publishing Manifest v1.0

The stable technical contract between Velgic, external AI tools, assets, and
future publishing providers. Canonical JSON with `"schema_version": "1.0"`,
versioned for future `1.1`/`2.0` via `SUPPORTED_SCHEMA_VERSIONS`.

Represented: schema version, manifest id, generated timestamp, timezone, brand
information, campaign, content, platforms, platform-specific metadata,
schedule, publishing status, published URLs, published timestamps, notes.

Full schema: [`docs/velgic-publishing-manifest.md`](velgic-publishing-manifest.md).

### Validation

Atomic — invalid manifests are never partially imported. Error codes carry a
JSON path and a human-readable message:

`INVALID_JSON`, `UNSUPPORTED_SCHEMA_VERSION`, `MISSING_CAMPAIGN`,
`MISSING_PLATFORM`, `MISSING_REQUIRED_METADATA`, `INVALID_DATETIME`,
`INVALID_PLATFORM_FORMAT` (case-insensitive format matching),
`INVALID_ASSET_REFERENCE` (type + role + reference), `INVALID_STATUS`,
`INVALID_CONTENT_TYPE`, `INVALID_PUBLISHED_URL`, `INVALID_TIMEZONE`,
`INVALID_METADATA`.

### Import / Export

- **Import** — paste JSON or upload `.json` → validate → import only when fully valid.
- **Export** — download `.json` or **Copy JSON**; exported JSON always validates
  against the canonical v1.0 schema.

## 6. External AI prompt workflow (AI optional)

Velgic never calls an AI API. The workflow is:

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

The prompt instructs the external AI to: return ONLY valid JSON, use no
markdown fences, give no explanations, invent no assets/URLs/dates, use `null`
for unavailable optionals, preserve provided asset references, use ISO 8601
datetimes, follow the Velgic schema exactly, and preserve factual/user-provided
information unless explicitly told to modify it. The AI is never required —
everything is manually editable.

## 7. Persistence

Zustand + localStorage (persist v3 with migrations). Everything survives
refresh: content, campaigns, platform versions, assets, publishing statuses,
published URLs, schedules, timestamps, metrics. Existing V1 data structures are
migrated in place, never discarded.

## 8. Intentionally deferred to V3

- Real AI-provider integration (the `AiProvider` abstraction and the external
  prompt workflow already cover 2.x needs)
- Social-media publishing APIs (scheduling is metadata only in 2.x)
- Automatic analytics ingestion
- Google Drive / Cloudflare R2 storage providers
- Authentication, database, background workers
