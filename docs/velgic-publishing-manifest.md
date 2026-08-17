# Velgic Publishing Manifest — Schema v1.0

The **Velgic Publishing Manifest v1.0** is the canonical, validated JSON package that
describes **one campaign**: the content concept it distributes, the platforms it
targets, the platform-specific metadata, asset references, scheduling, publishing
status, published URLs, and published timestamps.

It is the stable technical contract between Velgic, external AI tools, assets, and
future publishing providers:

```
Content
   ↓
Campaign
   ↓
Platform Versions
   ↓
Velgic Publishing Manifest (v1.0)
```

Implementation lives in `src/lib/manifest.ts`. The 13 validation error codes are
backed by the acceptance suites in `scripts/` (291/291 checks passing).

- **Export** — download a manifest (`.json`) for any campaign from the campaign page.
- **Copy JSON** — copy the manifest JSON straight to the clipboard.
- **AI generation** — Velgic generates a copy-paste prompt (with the exact schema
  embedded) for ChatGPT / Gemini / Claude / Grok / any AI tool. Paste the returned
  JSON into the importer.
- **Import** — paste JSON or upload a `.json` file. The whole manifest is validated
  first; nothing is imported unless it is fully valid.

---

## 1. Design rules

1. **Media is never embedded.** Assets appear as *references* (an id, a filename, a
   type, and a storage reference path) resolved by a `StorageProvider`
   (local/reference in V2; Google Drive / Cloudflare R2 are future providers, not
   implemented).
2. **URLs are never invented.** `published_url` is `null` until a post is actually
   live.
3. **Optionals are `null`, never absent.** Where a value is optional and unknown,
   export `null` (not `undefined`).
4. **Datetimes are ISO 8601** (e.g. `2026-08-20T19:30:00+05:30`).
5. **New platforms are additive.** A platform is a `platform` key plus a
   `metadata` object with that platform's documented shape. Adding a platform =
   extending the enum + adding a metadata table below; existing manifests remain
   valid.

---

## 2. Schema versioning

The current canonical schema version is **`1.0`**.

Velgic maintains the list of supported versions in `src/lib/manifest.ts`
(`SUPPORTED_SCHEMA_VERSIONS`, currently `['1.0']`). The application can always
determine:

- which schema versions are supported,
- whether an imported manifest is compatible,
- whether required fields are present.

A future `1.1` / `2.0` can be introduced by adding it to that list together with a
per-version migrator — the rest of the system stays unchanged. Importing any other
`schema_version` fails with `UNSUPPORTED_SCHEMA_VERSION`.

---

## 3. Top-level structure

| Field           | Type                | Required | Notes                                                            |
| --------------- | ------------------- | -------- | ---------------------------------------------------------------- |
| `schema_version`| string              | ✅        | Always `"1.0"`. Anything unsupported is rejected.                |
| `manifest_id`   | string              | ✅        | Stable per campaign (`velgic-manifest-<campaign-id>`).           |
| `generated_at`  | string (ISO 8601)   | ✅        | When the manifest was built.                                     |
| `timezone`      | string \| null      | —        | IANA name; inherited from the first scheduled platform version. Validated via `Intl.DateTimeFormat` (`INVALID_TIMEZONE`). |
| `brand`         | object              | ✅        | `{ "name": string\|null, "voice": string\|null, "handle": string\|null }` |
| `campaign`      | object              | ✅        | Campaign + content info (section 4).                              |
| `platforms`     | PlatformVersion[]   | ✅        | Non-empty array (section 5).                                      |

---

## 4. `campaign` structure

| Field       | Type   | Required | Notes                                |
| ----------- | ------ | -------- | ------------------------------------ |
| `id`        | string | ✅        | Campaign id.                         |
| `name`      | string | ✅        | Non-empty (`MISSING_CAMPAIGN` otherwise). |
| `description` | string \| null | — |                                        |
| `status`    | string | —        | Optional. One of: `draft`, `ready`, `partially_published`, `published`, `archived`. When absent on import, Velgic derives it from the platform versions (section 7). |
| `content`   | object | ✅        | The content concept (below).         |

### 4.1 `campaign.content` structure

| Field                  | Type              | Required | Notes                                   |
| ---------------------- | ----------------- | -------- | --------------------------------------- |
| `id`                   | string            | ✅        | Content id.                             |
| `title`                | string            | ✅        | Non-empty.                              |
| `concept`              | string            | ✅        | The angle / thesis.                     |
| `origin`               | string            | ✅        | One of the supported origins (section 4.2). |
| `audience`             | string            | ✅        |                                            |
| `content_type`         | string            | ✅        | One of the supported content types (section 4.3). |
| `format`               | string \| null    | —        | Free-form format description.           |
| `hook`                 | string \| null    | —        |                                            |
| `draft`                | string \| null    | —        |                                            |
| `notes`                | string \| null    | —        |                                            |
| `status`               | string            | ✅        | One of: `draft`, `in_production`, `ready`, `published`, `archived` (legacy `scheduled`/`failed` values are accepted and normalized on import). |
| `linked_idea_id`       | string \| null    | —        | Id of the originating idea, when known. |
| `linked_experiment_id` | string \| null    | —        | Id of the originating experiment, when known. |

### 4.2 Supported content origins

`idea` · `experiment` · `research` · `observation` · `opinion` · `trend` ·
`personal_experience` · `direct`

Unknown origins fail with `INVALID_METADATA`.

### 4.3 Supported content types

`reel` · `carousel` · `short_video` · `linkedin_post` · `x_post` · `x_thread` ·
`youtube_short` · `youtube_video` · `article` · `tutorial`

Unknown content types fail with `INVALID_CONTENT_TYPE`.

Content status is independent of the production Pipeline
(Ideas → Research → Script → Production → Published) — both systems may
legitimately hold different states.

---

## 5. `platforms[]` — platform versions

Each entry is one platform version of the campaign. Platform versions are
independently editable and independently publishable — their statuses are
independent:

```
Instagram → Published
YouTube   → Scheduled
LinkedIn  → Ready
X         → Draft
```

| Field           | Type          | Required | Notes                                                        |
| --------------- | ------------- | -------- | ------------------------------------------------------------ |
| `platform`      | string        | ✅        | One of: `instagram`, `youtube`, `linkedin`, `x`.             |
| `id`            | string        | ✅        | Platform version id.                                         |
| `format`        | string        | ✅        | Platform-specific format (section 6; matching is case-insensitive, canonical casing applied on import). |
| `status`        | string        | ✅        | One of: `draft`, `ready`, `scheduled`, `published`, `failed`.|
| `schedule`      | object        | ✅        | `{ "enabled": boolean, "datetime": string\|null, "timezone": string\|null }` (section 8). |
| `published_url` | string \| null| —        | A valid `http(s)://` URL when present, otherwise `null` until the post is live. |
| `published_at`  | string \| null| —        | ISO 8601 published timestamp.                                |
| `assets`        | AssetRef[]    | ✅        | Array (may be empty).                                        |
| `notes`         | string \| null| —        | Version-specific notes.                                      |
| `metadata`      | object        | ✅        | Platform-specific metadata (section 7).                      |

---

## 6. Supported platforms and formats

| Platform    | Formats                  |
| ----------- | ------------------------ |
| `instagram` | `Reel`, `Carousel`, `Post` |
| `youtube`   | `Short`, `Video`         |
| `linkedin`  | `Post`, `Article`        |
| `x`         | `Post`, `Thread`         |

**Format matching on import is case-insensitive and normalized to canonical
case** — `"reel"` and `"Reel"` both import as the canonical `Reel`. Unknown
platforms or disallowed formats fail with `INVALID_PLATFORM_FORMAT`.

---

## 7. Platform-specific `metadata`

Metadata is **not flattened** into generic fields — each platform keeps its own
structure.

### 7.1 Instagram

```json
{
  "caption": "string (required)",
  "hashtags": ["string", "…"],        // required, array of strings
  "location": "string | null"          // optional
}
```

### 7.2 YouTube

```json
{
  "title": "string (required, non-empty)",
  "description": "string (required)",
  "tags": ["string", "…"]               // required, array of strings
}
```

Video and thumbnail are expressed through the platform-level `assets` array
using `role: "video"` and `role: "thumbnail"`.

### 7.3 LinkedIn

```json
{
  "post_text": "string (required)"
}
```

### 7.4 X

```json
{
  "content": "string (required)",        // full post, or the full thread text
  "is_thread": "boolean (required)",
  "thread": ["string", "…"] | null       // required as an array when is_thread is true
}
```

---

## 8. Asset structure and roles

Each asset entry is a **reference only** — binary media must never be embedded in
the manifest.

| Field       | Type             | Required | Notes                                                        |
| ----------- | ---------------- | -------- | ------------------------------------------------------------ |
| `asset_id`  | string           | ✅        | Logical id, e.g. `instagram-reel-01`.                        |
| `filename`  | string           | ✅        | e.g. `reel.mp4`.                                             |
| `type`      | string           | ✅        | One of: `video`, `image`, `audio`, `document`, `link`.       |
| `reference` | string           | ✅        | Storage reference path, e.g. `instagram/reel.mp4` — resolved by the active StorageProvider. Never the media itself. |
| `provider`  | string           | —        | Storage provider (`local` today; `gdrive` / `r2` later).     |
| `role`      | string \| null   | —        | `video` \| `thumbnail` \| `media` \| `null`.                 |
| `mimeType`  | string \| null   | —        | Optional, e.g. `video/mp4`.                                  |
| `size`      | number \| null   | —        | Optional, bytes.                                             |
| `duration`  | number \| null   | —        | Optional, seconds (video/audio).                             |

**Asset roles are exactly one of `video`, `thumbnail`, `media`, or `null`.**
Any other role fails with `INVALID_ASSET_REFERENCE`.

**App-level asset fields such as `createdAt` and `notes` are intentionally
outside Manifest v1.0** (see section 12) — they exist only in the in-app asset
library and are never serialized into the manifest.

---

## 9. Scheduling

Each platform version carries:

```json
{
  "enabled": true,
  "datetime": "2026-08-20T18:00:00+05:30",
  "timezone": "Asia/Kolkata"
}
```

Rules:

- `enabled` is a boolean.
- `datetime` must be a **valid ISO 8601** value when `enabled` is `true`
  (`INVALID_DATETIME` otherwise; a schedule that is enabled without a datetime is
  rejected). When `enabled` is `false`, `datetime` is `null`:
  `{ "enabled": false, "datetime": null }`.
- `timezone` is optional. When present and non-empty it must be a **valid IANA
  timezone name** — validated via `Intl.DateTimeFormat`
  (`INVALID_TIMEZONE` for top-level `timezone` and per-schedule `timezone`).
- `generated_at` and `published_at` are also ISO 8601 and validated the same way.

**Schedule data is publishing metadata in V2.** Velgic does not automatically
publish or schedule anything through social APIs — scheduling only records the
intent and feeds the manifest.

---

## 10. Statuses

| Scope              | Allowed values                                                                    |
| ------------------ | --------------------------------------------------------------------------------- |
| Content            | `draft`, `in_production`, `ready`, `published`, `archived` (legacy `scheduled`/`failed` normalized on import) |
| Campaign           | `draft`, `ready`, `partially_published`, `published`, `archived` (optional; derived from platforms when absent) |
| Platform version   | `draft`, `ready`, `scheduled`, `published`, `failed`                              |

Unknown statuses fail with `INVALID_STATUS`. On import, when `campaign.status` is
absent Velgic derives it from the platform versions: all published → `published`,
any published → `partially_published`, all ready → `ready`, otherwise `draft`.

---

## 11. Validation rules

Import validation runs on the whole manifest. If **any** issue is found, nothing
is imported — **invalid manifests are rejected atomically, never partially
imported**. Every issue carries a JSON path (e.g.
`$.platforms[0].schedule.datetime`) and a human-readable message.

| Code                          | Meaning                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `INVALID_JSON`                | The pasted/uploaded text is not valid JSON.                    |
| `UNSUPPORTED_SCHEMA_VERSION`  | Missing `schema_version`, or not in `SUPPORTED_SCHEMA_VERSIONS` (`1.0`). |
| `MISSING_CAMPAIGN`            | `campaign` missing/not an object, `campaign.name` empty, or `campaign.content` missing. |
| `MISSING_PLATFORM`            | `platforms` missing, not an array, or empty.                   |
| `MISSING_REQUIRED_METADATA`   | A required field (or platform metadata key) is missing or has the wrong type. |
| `INVALID_DATETIME`            | A datetime is not valid ISO 8601, or `schedule.enabled` is true without a datetime. |
| `INVALID_PLATFORM_FORMAT`     | Unknown platform, or a format not allowed for that platform.   |
| `INVALID_ASSET_REFERENCE`     | An asset is missing `asset_id` / `filename` / `reference`, has an unknown `type`, has a `role` outside `video` \| `thumbnail` \| `media` \| `null`, or has invalid optional metadata types. |
| `INVALID_STATUS`              | A status value outside the allowed sets (content, campaign, or platform). |
| `INVALID_CONTENT_TYPE`        | `campaign.content.content_type` is not a known content type.   |
| `INVALID_PUBLISHED_URL`       | `published_url` is present but is not a valid `http(s)://` URL. |
| `INVALID_TIMEZONE`            | A `timezone` value (top level or schedule) is not a valid IANA name. |
| `INVALID_METADATA`            | Other malformed optional/metadata values.                      |

---

## 12. Import and export behavior

### Import

1. JSON is parsed (`INVALID_JSON` on failure) and fully validated.
2. Nothing is imported unless the **entire** manifest is valid.
3. Valid manifests create one Content item, one Campaign, and one Platform
   version per `platforms[]` entry.
4. Ids are preserved when unique; a manifest id that collides with existing data
   is uniquified (suffix).
5. Assets are registered in the reusable asset library, deduplicated by
   `asset_id` + `reference`; an `asset_id` that collides with a *different*
   reference is uniquified without breaking the manifest.
6. `linked_idea_id` / `linked_experiment_id` are kept only when matching local
   ideas/experiments exist.
7. Platform formats are normalized to canonical case; campaign `platforms[]`
   mirrors the imported versions; `campaign.status` is used when present,
   otherwise derived.
8. Legacy content statuses (`scheduled`/`failed`) are normalized to current
   values.

### Export

- **Download** — `velgic-manifest-<slug>.json` (campaign-name slug).
- **Copy JSON** — the same canonical JSON to the clipboard.
- Exported JSON is always the canonical v1.0 schema and always validates
  cleanly against it.

---

## 13. External-AI prompt workflow

Velgic generates a prompt for an **external** AI tool; **V2 does not call an AI
API**. The workflow is:

```
Velgic
 ↓
Generate Prompt
 ↓
External AI (ChatGPT / Gemini / Claude / Grok / any AI tool)
 ↓
JSON
 ↓
Import
 ↓
Validate
 ↓
Publishing Manifest
```

The generated prompt contains the current Content + Campaign + Platform values
(`{{CONTENT_TITLE}}`, `{{CONTENT_CONCEPT}}`, `{{CONTENT_ORIGIN}}`,
`{{CONTENT_TYPE}}`, `{{CONTENT_FORMAT}}`, `{{HOOK}}`, `{{TARGET_AUDIENCE}}`,
`{{CONTENT_STATUS}}`, `{{BRAND_NAME}}`, `{{BRAND_VOICE}}`, `{{BRAND_HANDLE}}`,
`{{PLATFORMS}}`, `{{FORMATS}}`, `{{ASSETS}}`, `{{TIMEZONE}}`, `{{SCHEDULE}}`,
`{{PUBLISHED_URL}}`, `{{HASHTAGS}}`, `{{LOCATION}}`, …), the existing platform
text, the complete schema above, and the strict JSON output rules:

1. Return ONLY valid JSON.
2. Do not use markdown fences (no \`\`\`json … \`\`\` wrappers).
3. Do not provide explanations, commentary, or any text outside the JSON.
4. Do not invent assets. Only reference the asset references provided below.
5. Do not invent URLs. Use null when a published URL is unknown.
6. Do not invent dates. Only use the schedule datetimes provided below.
7. Use null for unavailable optional values.
8. Follow the Velgic schema exactly — keep every required field and its type.
9. Preserve provided asset references (asset_id, filename, type, reference) unchanged.
10. Use valid ISO 8601 datetime values (e.g. 2026-08-20T09:00:00-04:00).
11. Respect the requested platform and format values.
12. Preserve factual/user-provided information unless explicitly instructed to modify it.

**The prompt includes exact ISO 8601 datetimes and complete asset fields**
(reference, filename, type, asset_id, role, provider, mimeType, size, duration)
in its CONTEXT because this was validated through the external-AI round-trip
testing (`scripts/acceptance-ai-roundtrip.ts`): without exact ISO values the
external AI reconstructed schedules with drift, and without complete asset
fields it could not obey rule 9. A NOTE in the prompt clarifies that the
embedded EXAMPLE JSON shows the shape only — values must be filled from the
CONTEXT and EXISTING PLATFORM TEXT sections.

Velgic's job is defining the contract and validating the result — the external
AI just generates the JSON. Everything remains fully manually editable: AI is
never required.

---

## 14. Relationship to the in-app asset library

The manifest's asset entries are the exchange representation. Inside the app,
assets live in a **reusable asset library** (Zustand + localStorage): each
library asset carries the canonical fields above plus two app-level fields that
are deliberately NOT part of the manifest — `createdAt` and `notes`. Platform
versions reference library assets by `asset_id`; the same asset can be used by
several campaigns/platform versions, usage is visible in the UI, and referenced
assets cannot be deleted. Binary media is never stored anywhere.

Platform versions also retain optional, manually entered `metrics`
(views/likes/comments/shares/saves) for future Insights — these are app-level
data and are not part of the manifest v1.0 contract.

---

## 15. Storage abstraction

Assets are references resolved by a `StorageProvider`
(`src/lib/storage.ts`):

```
StorageProvider
├── Local / reference implementation (V2, active)
├── Google Drive (future — not implemented)
└── Cloudflare R2 (future — not implemented)
```

References are storage-agnostic, so `gdrive/…` and `r2/…` prefixes can be
supported later without changing the manifest. No Google Drive API integration
exists in V2; local/reference-based assets keep the app fully self-contained.

---

## 16. Example

The canonical example uses the end-to-end test case:

```
Content:   Top open-source alternatives for content creators
Campaign:  Top Open Source Alternatives
           ├── Instagram → Reel      (published, URL live)
           ├── YouTube   → Short     (scheduled 2026-08-20T18:00:00+05:30)
           ├── LinkedIn  → Post      (ready)
           └── X         → Thread    (draft)
```

```json
{
  "schema_version": "1.0",
  "manifest_id": "velgic-manifest-camp-04",
  "generated_at": "2026-08-17T09:00:00Z",
  "timezone": "Asia/Kolkata",
  "brand": { "name": null, "voice": null, "handle": null },
  "campaign": {
    "id": "camp-04",
    "name": "Top Open Source Alternatives",
    "description": "One content concept, distributed across four platforms.",
    "status": "partially_published",
    "content": {
      "id": "content-04",
      "title": "Top open-source alternatives for content creators",
      "concept": "Free, open-source replacements for the paid creator stack — each with one honest caveat.",
      "origin": "research",
      "audience": "Technical creators",
      "content_type": "short_video",
      "format": "Vertical short-form",
      "hook": "You do not need to pay for your creator stack. Here are the open-source tools I actually use.",
      "draft": null,
      "notes": null,
      "status": "in_production",
      "linked_idea_id": null,
      "linked_experiment_id": null
    }
  },
  "platforms": [
    {
      "platform": "instagram",
      "id": "pc-11",
      "format": "Reel",
      "status": "published",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": "https://www.instagram.com/reel/oss-creators",
      "published_at": "2026-08-15T10:30:00Z",
      "assets": [
        { "asset_id": "instagram-reel-03", "filename": "oss-reel.mp4", "type": "video", "reference": "instagram/oss-reel.mp4", "provider": "local", "role": "media", "mimeType": "video/mp4", "size": 24800000, "duration": 42 }
      ],
      "notes": null,
      "metadata": {
        "caption": "You do not need to pay for your creator stack. Here are the open-source tools I actually use.",
        "hashtags": ["#opensource", "#creators", "#buildinpublic"],
        "location": null
      }
    },
    {
      "platform": "youtube",
      "id": "pc-12",
      "format": "Short",
      "status": "scheduled",
      "schedule": { "enabled": true, "datetime": "2026-08-20T18:00:00+05:30", "timezone": "Asia/Kolkata" },
      "published_url": null,
      "published_at": null,
      "assets": [
        { "asset_id": "youtube-short-03", "filename": "oss-short.mp4", "type": "video", "reference": "youtube/oss-short.mp4", "provider": "local", "role": "video", "mimeType": "video/mp4", "size": null, "duration": 42 },
        { "asset_id": "youtube-thumb-03", "filename": "oss-thumb.jpg", "type": "image", "reference": "youtube/oss-thumb.jpg", "provider": "local", "role": "thumbnail", "mimeType": "image/jpeg", "size": 320000, "duration": null }
      ],
      "notes": null,
      "metadata": {
        "title": "Top open-source alternatives for content creators",
        "description": "The free, open-source replacements for your paid creator stack — with one honest caveat per tool.",
        "tags": ["open source", "creator tools", "oss"]
      }
    },
    {
      "platform": "linkedin",
      "id": "pc-13",
      "format": "Post",
      "status": "ready",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": null,
      "published_at": null,
      "assets": [],
      "notes": null,
      "metadata": {
        "post_text": "You do not need a paid subscription for every part of your creator stack. Here are the open-source tools I actually use — and the one honest caveat for each."
      }
    },
    {
      "platform": "x",
      "id": "pc-14",
      "format": "Thread",
      "status": "draft",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": null,
      "published_at": null,
      "assets": [],
      "notes": null,
      "metadata": {
        "content": "You do not need to pay for your creator stack.",
        "is_thread": true,
        "thread": [
          "You do not need to pay for your creator stack.",
          "Every paid tool I replaced with an open-source alternative — and the one caveat that keeps me honest.",
          "Video editing, design, hosting, analytics: there is an open-source option for each.",
          "The caveat: free means you trade money for setup time. Bookmark the ones worth that trade."
        ]
      }
    }
  ]
}
```
