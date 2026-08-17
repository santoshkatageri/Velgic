# Velgic Publishing Manifest — Schema v1.0

The Velgic Publishing Manifest is the canonical, validated JSON package that describes
**one campaign**: the content concept it distributes, the platforms it targets, the
platform-specific metadata, asset references, scheduling, publishing status, and
published URLs.

It is the technical contract between Velgic, external AI tools, assets, and future
publishing providers:

```
Content
   ↓
Campaign
   ↓
Platform Versions
   ↓
Velgic Publishing Manifest
```

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
   (local/reference in V2; Google Drive / Cloudflare R2 can be added later).
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
(`SUPPORTED_SCHEMA_VERSIONS`). The application can always determine:

- which schema versions are supported,
- whether an imported manifest is compatible,
- whether required fields are present.

A future `1.1` / `2.0` can be introduced by adding it to that list together with a
per-version migrator — the rest of the system stays unchanged.

---

## 3. Top level

| Field           | Type                | Required | Notes                                                            |
| --------------- | ------------------- | -------- | ---------------------------------------------------------------- |
| `schema_version`| string              | ✅        | Always `"1.0"`. Anything unsupported is rejected.                |
| `manifest_id`   | string              | ✅        | Stable per campaign (`velgic-manifest-<campaign-id>`).           |
| `generated_at`  | string (ISO 8601)   | ✅        | When the manifest was built.                                     |
| `timezone`      | string \| null      | —        | IANA name; inherited from the first scheduled platform version.  |
| `brand`         | object              | ✅        | `{ "name": string\|null, "voice": string\|null, "handle": string\|null }` |
| `campaign`      | object              | ✅        | Campaign + content info (section 4).                              |
| `platforms`     | PlatformVersion[]   | ✅        | Non-empty array (section 5).                                      |

---

## 4. `campaign`

| Field       | Type   | Required | Notes                                |
| ----------- | ------ | -------- | ------------------------------------ |
| `id`        | string | ✅        | Campaign id.                         |
| `name`      | string | ✅        | Non-empty.                           |
| `description` | string \| null | — |                                        |
| `status`    | string | —        | Optional. One of: `draft`, `ready`, `partially_published`, `published`, `archived`. When absent on import, Velgic derives it from the platform versions. |
| `content`   | object | ✅        | The content concept (below).         |

### 4.1 `campaign.content`

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
| `status`               | string            | ✅        | One of: `draft`, `in_production`, `ready`, `published`, `archived` (legacy `scheduled`/`failed` values are accepted and normalized). |
| `linked_idea_id`       | string \| null    | —        | Id of the originating idea, when known. |
| `linked_experiment_id` | string \| null    | —        | Id of the originating experiment, when known. |

Content status is independent of the production Pipeline
(Ideas → Research → Script → Production → Published) — both systems may
legitimately hold different states.

---

## 5. `platforms[]` — platform versions

Each entry is one platform version of the campaign. Platform versions are
independently editable, and their statuses are independent:

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
| `schedule`      | object        | ✅        | `{ "enabled": boolean, "datetime": string\|null, "timezone": string\|null }`. `datetime` (ISO 8601) is required when `enabled` is `true`; `timezone` is optional (IANA name). |
| `published_url` | string \| null| —        | A valid `http(s)://` URL when present, otherwise `null` until the post is live. |
| `published_at`  | string \| null| —        | ISO 8601.                                                    |
| `assets`        | AssetRef[]    | ✅        | Array (may be empty).                                        |
| `notes`         | string \| null| —        | Version-specific notes.                                      |
| `metadata`      | object        | ✅        | Platform-specific metadata (section 7).                      |

### 5.1 Asset references

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

---

## 6. Allowed formats per platform

| Platform    | Formats                  |
| ----------- | ------------------------ |
| `instagram` | `Reel`, `Carousel`, `Post` |
| `youtube`   | `Short`, `Video`         |
| `linkedin`  | `Post`, `Article`        |
| `x`         | `Post`, `Thread`         |

Format matching on import is case-insensitive (`"reel"` and `"Reel"` both import as
the canonical `Reel`).

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

## 8. Validation

Import validation runs on the whole manifest. If **any** issue is found, nothing
is imported (no partial imports). Issue codes:

| Code                          | Meaning                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `INVALID_JSON`                | The pasted/uploaded text is not valid JSON.                    |
| `UNSUPPORTED_SCHEMA_VERSION`  | Missing `schema_version`, or not in the supported list (`1.0`). |
| `MISSING_CAMPAIGN`            | `campaign` missing/not an object, `campaign.name` empty, or `campaign.content` missing. |
| `MISSING_PLATFORM`            | `platforms` missing, not an array, or empty.                   |
| `MISSING_REQUIRED_METADATA`   | A required field (or platform metadata key) is missing or has the wrong type. |
| `INVALID_DATETIME`            | A datetime is not valid ISO 8601, or `schedule.enabled` is true without a datetime. |
| `INVALID_PLATFORM_FORMAT`     | Unknown platform, or a format not allowed for that platform.   |
| `INVALID_ASSET_REFERENCE`     | An asset is missing `asset_id` / `filename` / `reference`, has an unknown `type`, or has invalid optional metadata types. |
| `INVALID_STATUS`              | A status value outside the allowed sets (content, campaign, or platform). |
| `INVALID_CONTENT_TYPE`        | `campaign.content.content_type` is not a known content type.   |
| `INVALID_PUBLISHED_URL`       | `published_url` is present but is not a valid `http(s)://` URL. |
| `INVALID_METADATA`            | Other malformed optional/metadata values.                      |

Every issue carries a JSON path (e.g. `$.platforms[0].schedule.datetime`) and a
human-readable message, so failures are easy to fix.

---

## 9. Example

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

---

## 10. AI prompt workflow

The **Generate AI prompt** action (campaign page) produces a prompt for any
external AI tool. It embeds the current Content + Campaign + Platform values,
the complete schema above, and instructs the model to:

- return **only** valid JSON,
- use **no** markdown code fences,
- give **no** explanations,
- **not** invent assets, **not** invent URLs, **not** invent dates,
- use `null` for unavailable optional values,
- preserve provided asset references,
- use valid ISO 8601 datetimes,
- follow the Velgic Publishing Manifest schema exactly.

Velgic's job is defining the contract and validating the result — the external AI
just generates the JSON. Everything remains fully manually editable: AI is never
required.

Placeholders (`{{CONTENT_TITLE}}`, `{{CONTENT_CONCEPT}}`, `{{TARGET_AUDIENCE}}`,
`{{PLATFORMS}}`, `{{FORMATS}}`, `{{ASSETS}}`, `{{BRAND_VOICE}}`,
`{{TIMEZONE}}`, `{{SCHEDULE}}`, `{{CONTENT_STATUS}}`, `{{CAMPAIGN_STATUS}}`, …)
are filled with the campaign's current values and stay literal wherever Velgic has
no value yet.

---

## 11. Storage abstraction

Assets are references resolved by a `StorageProvider`
(`src/lib/storage.ts`):

```
StorageProvider
├── Local / reference implementation (V2, active)
├── Google Drive (future)
└── Cloudflare R2 (future)
```

References are storage-agnostic, so `gdrive/…` and `r2/…` prefixes can be
supported later without changing the manifest. No Google Drive API integration is
required in V2; local/reference-based assets keep the app fully self-contained.
