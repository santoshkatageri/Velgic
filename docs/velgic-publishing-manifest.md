# Velgic Publishing Manifest — Schema v1.0

The Velgic Publishing Manifest is the canonical, validated JSON package that describes
**one campaign**: the content concept it distributes, the platforms it targets, the
platform-specific metadata, asset references, scheduling, publishing status, and
published URLs.

It is the interchange format for the V2 publishing workflow:

```
Any content idea → multi-platform campaign → Velgic publishing JSON → validated publishing package
```

- **Export** — download a manifest for any campaign from the campaign page.
- **AI generation** — Velgic generates a copy-paste prompt (with the exact schema
  embedded) for ChatGPT / Gemini / Claude / Grok / any AI tool. Paste the returned
  JSON into the importer.
- **Import** — paste JSON or upload a `.json` file. The whole manifest is validated
  first; nothing is imported unless it is fully valid.

---

## 1. Design rules

1. **Media is never embedded.** Assets appear as *references* (an id, a filename, a
   type, and a storage reference path) resolved by a `StorageProvider`
   (local/reference in V2; Google Drive / Cloudflare R2 can be added later).
2. **URLs are never invented.** `published_url` is `null` until a post is actually
   live.
3. **Optionals are `null`, never absent.** Where a value is optional and unknown,
   export `null` (not `undefined`).
4. **Datetimes are ISO 8601** (e.g. `2026-08-20T09:00:00-04:00`).
5. **New platforms are additive.** A platform is a `platform` key plus a
   `metadata` object with that platform's documented shape. Adding a platform =
   extending the enum + adding a metadata table below; existing manifests remain
   valid.

---

## 2. Top level

| Field           | Type                | Required | Notes                                                            |
| --------------- | ------------------- | -------- | ---------------------------------------------------------------- |
| `schema_version`| string              | ✅        | Always `"1.0"`. Anything else is rejected.                       |
| `manifest_id`   | string              | ✅        | Stable per campaign (`velgic-manifest-<campaign-id>`).           |
| `generated_at`  | string (ISO 8601)   | ✅        | When the manifest was built.                                     |
| `timezone`      | string \| null      | —        | IANA name; inherited from the first scheduled platform version.  |
| `brand`         | object              | ✅        | `{ "name": string\|null, "voice": string\|null, "handle": string\|null }` |
| `campaign`      | object              | ✅        | Campaign + content info (section 3).                              |
| `platforms`     | PlatformVersion[]   | ✅        | Non-empty array (section 4).                                      |

---

## 3. `campaign`

| Field       | Type   | Required | Notes                                |
| ----------- | ------ | -------- | ------------------------------------ |
| `id`        | string | ✅        | Campaign id.                         |
| `name`      | string | ✅        | Non-empty.                           |
| `description` | string \| null | — |                                        |
| `content`   | object | ✅        | The content concept (below).         |

### 3.1 `campaign.content`

| Field                  | Type              | Required | Notes                                   |
| ---------------------- | ----------------- | -------- | --------------------------------------- |
| `id`                   | string            | ✅        | Content id.                             |
| `title`                | string            | ✅        | Non-empty.                              |
| `concept`              | string            | ✅        | The angle / thesis.                     |
| `origin`               | string            | ✅        | One of: `idea`, `experiment`, `research`, `observation`, `opinion`, `trend`, `personal_experience`, `direct`. |
| `audience`             | string            | ✅        |                                            |
| `content_type`         | string            | ✅        | One of: `reel`, `carousel`, `short_video`, `linkedin_post`, `x_post`, `x_thread`, `youtube_short`, `youtube_video`, `article`, `tutorial`. |
| `format`               | string \| null    | —        | Free-form format description.           |
| `hook`                 | string \| null    | —        |                                            |
| `draft`                | string \| null    | —        |                                            |
| `notes`                | string \| null    | —        |                                            |
| `status`               | string            | ✅        | One of: `draft`, `ready`, `scheduled`, `published`, `failed`. |
| `linked_idea_id`       | string \| null    | —        | Id of the originating idea, when known. |
| `linked_experiment_id` | string \| null    | —        | Id of the originating experiment, when known. |

---

## 4. `platforms[]` — platform versions

Each entry is one platform version of the campaign. Platform versions are
independently editable.

| Field           | Type          | Required | Notes                                                        |
| --------------- | ------------- | -------- | ------------------------------------------------------------ |
| `platform`      | string        | ✅        | One of: `instagram`, `youtube`, `linkedin`, `x`.             |
| `id`            | string        | ✅        | Platform version id.                                         |
| `format`        | string        | ✅        | Platform-specific format (table in section 5).               |
| `status`        | string        | ✅        | One of: `draft`, `ready`, `scheduled`, `published`, `failed`.|
| `schedule`      | object        | ✅        | `{ "enabled": boolean, "datetime": string\|null, "timezone": string\|null }`. `datetime` (ISO 8601) is required when `enabled` is `true`. |
| `published_url` | string \| null| —        | `null` until the post is live.                               |
| `published_at`  | string \| null| —        | ISO 8601.                                                    |
| `assets`        | AssetRef[]    | ✅        | Array (may be empty).                                        |
| `metadata`      | object        | ✅        | Platform-specific metadata (section 6).                      |

### 4.1 Asset references

| Field       | Type             | Required | Notes                                                        |
| ----------- | ---------------- | -------- | ------------------------------------------------------------ |
| `asset_id`  | string           | ✅        | Logical id, e.g. `instagram-reel-01`.                        |
| `filename`  | string           | ✅        | e.g. `reel.mp4`.                                             |
| `type`      | string           | ✅        | One of: `video`, `image`, `audio`, `document`, `link`.       |
| `reference` | string           | ✅        | Storage reference path, e.g. `instagram/reel.mp4` — resolved by the active StorageProvider. Never the media itself. |
| `provider`  | string           | —        | Storage provider (`local` today; `gdrive` / `r2` later).     |
| `role`      | string \| null   | —        | `video` \| `thumbnail` \| `media` \| `null`.                 |

---

## 5. Allowed formats per platform

| Platform    | Formats                                          |
| ----------- | ------------------------------------------------ |
| `instagram` | `Reel`, `Carousel`, `Post`, `Story`, `Video`     |
| `youtube`   | `Short`, `Video`, `Live`                         |
| `linkedin`  | `Post`, `Article`, `Carousel`, `Video`, `Newsletter` |
| `x`         | `Post`, `Thread`                                 |

---

## 6. Platform-specific `metadata`

### 6.1 Instagram

```json
{
  "caption": "string (required)",
  "hashtags": ["string", "…"],        // required, array of strings
  "location": "string | null"          // optional
}
```

### 6.2 YouTube

```json
{
  "title": "string (required, non-empty)",
  "description": "string (required)",
  "tags": ["string", "…"]               // required, array of strings
}
```

Video and thumbnail are expressed through the platform-level `assets` array
using `role: "video"` and `role: "thumbnail"`.

### 6.3 LinkedIn

```json
{
  "post_text": "string (required)"
}
```

### 6.4 X

```json
{
  "content": "string (required)",        // full post, or the full thread text
  "is_thread": "boolean (required)",
  "thread": ["string", "…"] | null       // required as an array when is_thread is true
}
```

---

## 7. Validation

Import validation runs on the whole manifest. If **any** issue is found, nothing
is imported. Issue codes:

| Code                          | Meaning                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `INVALID_JSON`                | The pasted/uploaded text is not valid JSON.                    |
| `UNSUPPORTED_SCHEMA_VERSION`  | Missing `schema_version`, or not `"1.0"`.                      |
| `MISSING_CAMPAIGN`            | `campaign` missing/not an object, `campaign.name` empty, or `campaign.content` missing. |
| `MISSING_PLATFORM`            | `platforms` missing, not an array, or empty.                   |
| `MISSING_REQUIRED_METADATA`   | A required field (or platform metadata key) is missing or has the wrong type. |
| `INVALID_DATETIME`            | A datetime is not valid ISO 8601, or `schedule.enabled` is true without a datetime. |
| `INVALID_PLATFORM_FORMAT`     | Unknown platform, or a format not allowed for that platform.   |
| `INVALID_ASSET_REFERENCE`     | An asset is missing `asset_id` / `filename` / `reference`, has an unknown `type`, or wrong types. |
| `INVALID_STATUS`              | A status value outside `draft` \| `ready` \| `scheduled` \| `published` \| `failed`. |
| `INVALID_CONTENT_TYPE`        | `campaign.content.content_type` is not a known content type.   |
| `INVALID_METADATA`            | Other malformed optional/metadata values.                      |

Every issue carries a JSON path (e.g. `$.platforms[0].schedule.datetime`) and a
human-readable message, so failures are easy to fix.

---

## 8. Example

```json
{
  "schema_version": "1.0",
  "manifest_id": "velgic-manifest-camp-03",
  "generated_at": "2026-08-17T09:00:00Z",
  "timezone": "America/New_York",
  "brand": { "name": null, "voice": null, "handle": null },
  "campaign": {
    "id": "camp-03",
    "name": "AI agents stuck in loops",
    "description": "One concept, four platforms.",
    "content": {
      "id": "content-03",
      "title": "Why AI agents get stuck in loops",
      "concept": "Agents loop because context breaks down, not reasoning.",
      "origin": "observation",
      "audience": "AI builders",
      "content_type": "short_video",
      "format": "Vertical short-form",
      "hook": "Your agent is not stuck — its memory is.",
      "draft": null,
      "notes": null,
      "status": "ready",
      "linked_idea_id": null,
      "linked_experiment_id": null
    }
  },
  "platforms": [
    {
      "platform": "instagram",
      "id": "pc-01",
      "format": "Reel",
      "status": "scheduled",
      "schedule": { "enabled": true, "datetime": "2026-08-20T09:00:00-04:00", "timezone": "America/New_York" },
      "published_url": null,
      "published_at": null,
      "assets": [
        { "asset_id": "instagram-reel-01", "filename": "reel.mp4", "type": "video", "reference": "instagram/reel.mp4", "provider": "local", "role": "media" }
      ],
      "metadata": {
        "caption": "Your AI agent is not stuck — its memory is. Three fixes inside.",
        "hashtags": ["#ai", "#aiagents", "#buildinpublic"],
        "location": null
      }
    },
    {
      "platform": "youtube",
      "id": "pc-02",
      "format": "Short",
      "status": "draft",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": null,
      "published_at": null,
      "assets": [
        { "asset_id": "youtube-short-01", "filename": "short.mp4", "type": "video", "reference": "youtube/short.mp4", "provider": "local", "role": "video" },
        { "asset_id": "youtube-thumb-01", "filename": "thumb.jpg", "type": "image", "reference": "youtube/thumb.jpg", "provider": "local", "role": "thumbnail" }
      ],
      "metadata": {
        "title": "Why AI agents get stuck in loops",
        "description": "Context is the bottleneck — and how to fix it.",
        "tags": ["ai agents", "llm", "automation"]
      }
    },
    {
      "platform": "linkedin",
      "id": "pc-03",
      "format": "Post",
      "status": "draft",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": null,
      "published_at": null,
      "assets": [],
      "metadata": {
        "post_text": "Most agent failures are context failures. Here is the anatomy of the loop and three fixes."
      }
    },
    {
      "platform": "x",
      "id": "pc-04",
      "format": "Thread",
      "status": "draft",
      "schedule": { "enabled": false, "datetime": null, "timezone": null },
      "published_url": null,
      "published_at": null,
      "assets": [],
      "metadata": {
        "content": "Your AI agent is not stuck in a loop — its memory is.",
        "is_thread": true,
        "thread": [
          "Your AI agent is not stuck in a loop — its memory is.",
          "The loop is a symptom: the model lost the context it needs to make progress.",
          "Three fixes: checkpointing, memory compaction, and explicit exit conditions."
        ]
      }
    }
  ]
}
```

---

## 9. AI prompt workflow

The **Generate AI prompt** action (campaign page) produces a prompt for any
external AI tool. It embeds this exact schema and instructs the model to:

- return **only** valid JSON,
- use **no** markdown fences,
- give **no** explanations,
- **not** invent assets, **not** invent URLs,
- use `null` for unavailable optional values,
- follow the Velgic schema exactly,
- preserve provided asset references,
- use valid ISO 8601 datetimes,
- respect the requested platforms and formats.

Placeholders (`{{CONTENT_TITLE}}`, `{{CONTENT_CONCEPT}}`, `{{TARGET_AUDIENCE}}`,
`{{PLATFORMS}}`, `{{FORMATS}}`, `{{ASSETS}}`, `{{BRAND_VOICE}}`,
`{{TIMEZONE}}`, `{{SCHEDULE}}`, …) are filled with the campaign's current values
and stay literal wherever Velgic has no value yet.

---

## 10. Storage abstraction

Assets are references resolved by a `StorageProvider`
(`src/lib/storage.ts`):

```
StorageProvider
├── Local / reference implementation (V2, active)
├── Google Drive (future)
└── Cloudflare R2 (future)
```

No Google Drive API integration is required in V2; local/reference-based assets
keep the app fully self-contained.
