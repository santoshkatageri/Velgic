import type {
  AssetRef,
  AssetType,
  Campaign,
  ContentItem,
  PlatformContent,
  PlatformKey,
  PublishStatus,
} from '../types'
import {
  ASSET_TYPES,
  CONTENT_ORIGINS,
  CONTENT_TYPES,
  PLATFORM_KEYS,
  PLATFORM_META,
  PUBLISH_STATUSES,
} from './constants'
import { nowIso, uid } from './utils'

/**
 * Velgic Publishing Manifest — canonical JSON interchange format.
 *
 * Full schema documentation: docs/velgic-publishing-manifest.md
 */

export const MANIFEST_SCHEMA_VERSION = '1.0'

export const MANIFEST_ISSUE_CODES = [
  'INVALID_JSON',
  'UNSUPPORTED_SCHEMA_VERSION',
  'MISSING_CAMPAIGN',
  'MISSING_PLATFORM',
  'MISSING_REQUIRED_METADATA',
  'INVALID_DATETIME',
  'INVALID_PLATFORM_FORMAT',
  'INVALID_ASSET_REFERENCE',
  'INVALID_STATUS',
  'INVALID_CONTENT_TYPE',
  'INVALID_METADATA',
] as const

export type ManifestIssueCode = (typeof MANIFEST_ISSUE_CODES)[number]

export interface ManifestIssue {
  code: ManifestIssueCode
  path: string
  message: string
}

/* -------------------------------------------------------------------------- */
/*  Wire types                                                                 */
/* -------------------------------------------------------------------------- */

export interface ManifestAssetRef {
  asset_id: string
  filename: string
  type: AssetType
  reference: string
  provider: string
  role: string | null
}

export interface ManifestSchedule {
  enabled: boolean
  datetime: string | null
  timezone: string | null
}

export interface ManifestPlatform {
  platform: PlatformKey
  id: string
  format: string
  status: PublishStatus
  schedule: ManifestSchedule
  published_url: string | null
  published_at: string | null
  assets: ManifestAssetRef[]
  /** Platform-specific metadata — see docs/velgic-publishing-manifest.md */
  metadata: Record<string, unknown>
}

export interface VelgicManifest {
  schema_version: string
  manifest_id: string
  generated_at: string
  timezone: string | null
  brand: { name: string | null; voice: string | null; handle: string | null }
  campaign: {
    id: string
    name: string
    description: string | null
    content: {
      id: string
      title: string
      concept: string
      origin: string
      audience: string
      content_type: string
      format: string | null
      hook: string | null
      draft: string | null
      notes: string | null
      status: PublishStatus
      linked_idea_id: string | null
      linked_experiment_id: string | null
    } | null
  }
  platforms: ManifestPlatform[]
}

/* -------------------------------------------------------------------------- */
/*  Building (export)                                                          */
/* -------------------------------------------------------------------------- */

function manifestAssets(assets: AssetRef[]): ManifestAssetRef[] {
  return assets.map((a) => ({
    asset_id: a.asset_id,
    filename: a.filename,
    type: a.type,
    reference: a.reference,
    provider: a.provider || 'local',
    role: a.role ?? null,
  }))
}

function manifestMetadata(pc: PlatformContent): Record<string, unknown> {
  switch (pc.platform) {
    case 'instagram':
      return {
        caption: pc.instagram?.caption ?? '',
        hashtags: pc.instagram?.hashtags ?? [],
        location: pc.instagram?.location || null,
      }
    case 'youtube':
      return {
        title: pc.youtube?.title ?? '',
        description: pc.youtube?.description ?? '',
        tags: pc.youtube?.tags ?? [],
      }
    case 'linkedin':
      return { post_text: pc.linkedin?.postText ?? '' }
    case 'x': {
      const content = pc.x?.content ?? ''
      const blocks = content
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
      const isThread = (pc.x?.isThread ?? false) || blocks.length > 1
      return { content, is_thread: isThread, thread: isThread ? blocks : null }
    }
  }
}

export function buildManifest(args: {
  campaign: Campaign
  content: ContentItem | null
  platformContents: PlatformContent[]
}): VelgicManifest {
  const { campaign, content, platformContents } = args
  const scheduled = platformContents.find((pc) => pc.schedule.enabled && pc.schedule.timezone)
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    manifest_id: `velgic-manifest-${campaign.id}`,
    generated_at: nowIso(),
    timezone: scheduled?.schedule.timezone ?? null,
    brand: { name: null, voice: null, handle: null },
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description || null,
      content: content
        ? {
            id: content.id,
            title: content.title,
            concept: content.concept,
            origin: content.origin,
            audience: content.audience,
            content_type: content.contentType,
            format: content.format || null,
            hook: content.hook || null,
            draft: content.draft || null,
            notes: content.notes || null,
            status: content.status,
            linked_idea_id: content.linkedIdeaId,
            linked_experiment_id: content.linkedExperimentId,
          }
        : null,
    },
    platforms: platformContents.map((pc) => ({
      platform: pc.platform,
      id: pc.id,
      format: pc.format,
      status: pc.status,
      schedule: {
        enabled: pc.schedule.enabled,
        datetime: pc.schedule.datetime,
        timezone: pc.schedule.timezone,
      },
      published_url: pc.publishedUrl,
      published_at: pc.publishedAt,
      assets: manifestAssets(pc.assets),
      metadata: manifestMetadata(pc),
    })),
  }
}

export function manifestSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'campaign'
  )
}

export function downloadManifest(manifest: VelgicManifest, filename?: string): void {
  const json = JSON.stringify(manifest, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `velgic-manifest-${manifest.campaign.id}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Build + download the manifest for a campaign. */
export function exportCampaignManifest(
  campaign: Campaign,
  content: ContentItem | null,
  platformContents: PlatformContent[],
): void {
  downloadManifest(buildManifest({ campaign, content, platformContents }), `velgic-manifest-${manifestSlug(campaign.name)}.json`)
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                 */
/* -------------------------------------------------------------------------- */

type UnknownRecord = Record<string, unknown>

function isObject(v: unknown): v is UnknownRecord {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}

function isValidIso(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0 && !Number.isNaN(Date.parse(v))
}

function hasOwn(obj: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function isPlatformKey(v: unknown): v is PlatformKey {
  return typeof v === 'string' && (PLATFORM_KEYS as readonly string[]).includes(v)
}

export function validateManifest(value: unknown): ManifestIssue[] {
  const issues: ManifestIssue[] = []
  const add = (code: ManifestIssueCode, path: string, message: string) => issues.push({ code, path, message })

  if (!isObject(value)) {
    add('MISSING_CAMPAIGN', '$', 'Manifest must be a JSON object.')
    return issues
  }

  // --- schema version -----------------------------------------------------
  if (!isString(value.schema_version)) {
    add('UNSUPPORTED_SCHEMA_VERSION', '$.schema_version', 'Manifest is missing "schema_version".')
    return issues
  }
  if (value.schema_version !== MANIFEST_SCHEMA_VERSION) {
    add(
      'UNSUPPORTED_SCHEMA_VERSION',
      '$.schema_version',
      `Unsupported schema version "${String(value.schema_version)}". Velgic supports "${MANIFEST_SCHEMA_VERSION}".`,
    )
    return issues
  }

  // --- top-level required fields ------------------------------------------
  if (!isString(value.manifest_id) || !value.manifest_id.trim()) {
    add('MISSING_REQUIRED_METADATA', '$.manifest_id', '"manifest_id" is required and must be a non-empty string.')
  }
  if (!isValidIso(value.generated_at)) {
    add('INVALID_DATETIME', '$.generated_at', '"generated_at" must be a valid ISO 8601 datetime.')
  }
  if (value.timezone !== undefined && value.timezone !== null && !isString(value.timezone)) {
    add('INVALID_METADATA', '$.timezone', '"timezone" must be a string (IANA name) or null.')
  }

  // --- campaign ------------------------------------------------------------
  const campaign = value.campaign
  if (!isObject(campaign)) {
    add('MISSING_CAMPAIGN', '$.campaign', 'Manifest is missing the "campaign" object.')
    return issues
  }
  if (!isString(campaign.id) || !campaign.id.trim()) {
    add('MISSING_REQUIRED_METADATA', '$.campaign.id', 'Campaign "id" is required and must be a non-empty string.')
  }
  if (!isString(campaign.name) || !campaign.name.trim()) {
    add('MISSING_CAMPAIGN', '$.campaign.name', 'Campaign "name" is required and must be a non-empty string.')
  }
  if (campaign.description !== undefined && campaign.description !== null && !isString(campaign.description)) {
    add('INVALID_METADATA', '$.campaign.description', 'Campaign "description" must be a string or null.')
  }

  const content = campaign.content
  if (!isObject(content)) {
    add('MISSING_CAMPAIGN', '$.campaign.content', 'Campaign "content" object is required.')
  } else {
    const needString = (key: string, path: string) => {
      const v = content[key]
      if (!isString(v)) add('MISSING_REQUIRED_METADATA', path, `"${key}" is required and must be a string.`)
      else if (!v.trim() && (key === 'id' || key === 'title'))
        add('MISSING_REQUIRED_METADATA', path, `"${key}" must be a non-empty string.`)
    }
    needString('id', '$.campaign.content.id')
    needString('title', '$.campaign.content.title')
    needString('concept', '$.campaign.content.concept')
    needString('origin', '$.campaign.content.origin')
    needString('audience', '$.campaign.content.audience')
    needString('content_type', '$.campaign.content.content_type')

    if (isString(content.origin) && !(CONTENT_ORIGINS as string[]).includes(content.origin)) {
      add('INVALID_METADATA', '$.campaign.content.origin', `Unknown origin "${content.origin}".`)
    }
    if (isString(content.content_type) && !(CONTENT_TYPES as string[]).includes(content.content_type)) {
      add('INVALID_CONTENT_TYPE', '$.campaign.content.content_type', `Unknown content type "${content.content_type}".`)
    }
    if (content.status !== undefined && content.status !== null) {
      if (!isString(content.status) || !(PUBLISH_STATUSES as string[]).includes(content.status)) {
        add('INVALID_STATUS', '$.campaign.content.status', `Invalid content status "${String(content.status)}".`)
      }
    }
    for (const key of ['format', 'hook', 'draft', 'notes', 'linked_idea_id', 'linked_experiment_id']) {
      const v = content[key]
      if (v !== undefined && v !== null && !isString(v)) {
        add('INVALID_METADATA', `$.campaign.content.${key}`, `"${key}" must be a string or null.`)
      }
    }
  }

  // --- platforms ------------------------------------------------------------
  const platforms = value.platforms
  if (!Array.isArray(platforms) || platforms.length === 0) {
    add('MISSING_PLATFORM', '$.platforms', 'Manifest must contain a non-empty "platforms" array.')
    return issues
  }

  platforms.forEach((p, i) => {
    const path = `$.platforms[${i}]`
    if (!isObject(p)) {
      add('MISSING_REQUIRED_METADATA', path, 'Platform entry must be an object.')
      return
    }

    // platform key + format
    const platform = p.platform
    if (!isPlatformKey(platform)) {
      add('INVALID_PLATFORM_FORMAT', `${path}.platform`, `Unknown platform "${String(platform)}".`)
      return
    }
    const format = p.format
    if (!isString(format) || !format.trim()) {
      add('INVALID_PLATFORM_FORMAT', `${path}.format`, 'Platform "format" is required and must be a non-empty string.')
    } else if (!PLATFORM_META[platform].formats.includes(format)) {
      add(
        'INVALID_PLATFORM_FORMAT',
        `${path}.format`,
        `Format "${format}" is not valid for ${PLATFORM_META[platform].label}. Allowed: ${PLATFORM_META[platform].formats.join(', ')}.`,
      )
    }

    if (!isString(p.id) || !p.id.trim()) {
      add('MISSING_REQUIRED_METADATA', `${path}.id`, 'Platform "id" is required and must be a non-empty string.')
    }
    if (!isString(p.status) || !(PUBLISH_STATUSES as string[]).includes(p.status)) {
      add('INVALID_STATUS', `${path}.status`, `Invalid platform status "${String(p.status)}".`)
    }

    // schedule
    if (p.schedule === undefined || p.schedule === null || !isObject(p.schedule)) {
      add('MISSING_REQUIRED_METADATA', `${path}.schedule`, 'Platform "schedule" object is required.')
    } else {
      const s = p.schedule
      if (typeof s.enabled !== 'boolean') {
        add('INVALID_METADATA', `${path}.schedule.enabled`, '"enabled" must be a boolean.')
      }
      if (s.datetime !== undefined && s.datetime !== null && !isValidIso(s.datetime)) {
        add('INVALID_DATETIME', `${path}.schedule.datetime`, '"datetime" must be a valid ISO 8601 datetime or null.')
      }
      if (s.enabled === true && (!isValidIso(s.datetime))) {
        add('INVALID_DATETIME', `${path}.schedule.datetime`, 'Schedule is enabled but "datetime" is missing or invalid.')
      }
      if (s.timezone !== undefined && s.timezone !== null && !isString(s.timezone)) {
        add('INVALID_METADATA', `${path}.schedule.timezone`, '"timezone" must be a string (IANA name) or null.')
      }
    }

    if (p.published_url !== undefined && p.published_url !== null && !isString(p.published_url)) {
      add('INVALID_METADATA', `${path}.published_url`, '"published_url" must be a string or null.')
    }
    if (p.published_at !== undefined && p.published_at !== null && !isValidIso(p.published_at)) {
      add('INVALID_DATETIME', `${path}.published_at`, '"published_at" must be a valid ISO 8601 datetime or null.')
    }

    // assets
    if (p.assets === undefined || p.assets === null) {
      add('MISSING_REQUIRED_METADATA', `${path}.assets`, 'Platform "assets" array is required.')
    } else if (!Array.isArray(p.assets)) {
      add('INVALID_ASSET_REFERENCE', `${path}.assets`, '"assets" must be an array.')
    } else {
      p.assets.forEach((a, ai) => {
        const apath = `${path}.assets[${ai}]`
        if (!isObject(a)) {
          add('INVALID_ASSET_REFERENCE', apath, 'Asset reference must be an object.')
          return
        }
        const asset = a as UnknownRecord
        for (const key of ['asset_id', 'filename', 'reference'] as const) {
          if (!isString(asset[key]) || !(asset[key] as string).trim()) {
            add('INVALID_ASSET_REFERENCE', `${apath}.${key}`, `"${key}" is required and must be a non-empty string.`)
          }
        }
        if (!isString(asset.type) || !(ASSET_TYPES as string[]).includes(asset.type)) {
          add('INVALID_ASSET_REFERENCE', `${apath}.type`, `Asset "type" must be one of: ${ASSET_TYPES.join(', ')}.`)
        }
        if (asset.provider !== undefined && !isString(asset.provider)) {
          add('INVALID_ASSET_REFERENCE', `${apath}.provider`, '"provider" must be a string.')
        }
        if (asset.role !== undefined && asset.role !== null && !isString(asset.role)) {
          add('INVALID_ASSET_REFERENCE', `${apath}.role`, '"role" must be a string or null.')
        }
      })
    }

    // platform-specific metadata
    if (!isObject(p.metadata)) {
      add('MISSING_REQUIRED_METADATA', `${path}.metadata`, `Platform "metadata" object is required for ${platform}.`)
      return
    }
    const m = p.metadata
    const strField = (key: string, nonEmpty = false) => {
      const v = m[key]
      if (!isString(v)) {
        add('MISSING_REQUIRED_METADATA', `${path}.metadata.${key}`, `"${key}" is required and must be a string${nonEmpty ? ' (non-empty)' : ''}.`)
      } else if (nonEmpty && !v.trim()) {
        add('MISSING_REQUIRED_METADATA', `${path}.metadata.${key}`, `"${key}" must be a non-empty string.`)
      }
    }
    const strArrayField = (key: string) => {
      const v = m[key]
      if (!Array.isArray(v) || v.some((x) => !isString(x))) {
        add('MISSING_REQUIRED_METADATA', `${path}.metadata.${key}`, `"${key}" is required and must be an array of strings.`)
      }
    }

    switch (platform) {
      case 'instagram':
        strField('caption')
        strArrayField('hashtags')
        if (m.location !== undefined && m.location !== null && !isString(m.location)) {
          add('MISSING_REQUIRED_METADATA', `${path}.metadata.location`, '"location" must be a string or null.')
        }
        break
      case 'youtube':
        strField('title', true)
        strField('description')
        strArrayField('tags')
        break
      case 'linkedin':
        strField('post_text')
        break
      case 'x':
        strField('content')
        if (m.is_thread === true && (!Array.isArray(m.thread) || m.thread.some((x) => !isString(x)))) {
          add('INVALID_METADATA', `${path}.metadata.thread`, 'When "is_thread" is true, "thread" must be an array of strings.')
        }
        break
    }
  })

  return issues
}

export function parseManifestText(text: string): { manifest: VelgicManifest | null; issues: ManifestIssue[] } {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return {
      manifest: null,
      issues: [{ code: 'INVALID_JSON', path: '$', message: 'The pasted text is not valid JSON. Check for missing commas, quotes, or trailing characters.' }],
    }
  }
  const issues = validateManifest(value)
  if (issues.length > 0) return { manifest: null, issues }
  return { manifest: value as VelgicManifest, issues: [] }
}

/* -------------------------------------------------------------------------- */
/*  Importing → app entities                                                   */
/* -------------------------------------------------------------------------- */

export interface ImportEntities {
  content: ContentItem
  campaign: Campaign
  platformContents: PlatformContent[]
}

export interface ImportContext {
  ideaIds: string[]
  experimentIds: string[]
  contentIds: string[]
  campaignIds: string[]
  platformContentIds: string[]
}

export function manifestToEntities(manifest: VelgicManifest, ctx: ImportContext): ImportEntities {
  const unique = (id: string, taken: string[]): string => (taken.includes(id) ? uid() : id)

  const contentId = unique(manifest.campaign.content?.id ?? uid(), ctx.contentIds)
  const campaignId = unique(manifest.campaign.id, ctx.campaignIds)
  const now = nowIso()

  const c = manifest.campaign.content
  const content: ContentItem = {
    id: contentId,
    title: c?.title ?? manifest.campaign.name,
    concept: c?.concept ?? '',
    origin: (c?.origin as ContentItem['origin']) ?? 'direct',
    audience: c?.audience ?? '',
    contentType: (c?.content_type as ContentItem['contentType']) ?? 'short_video',
    format: c?.format ?? '',
    hook: c?.hook ?? '',
    draft: c?.draft ?? '',
    notes: c?.notes ?? '',
    status: c?.status ?? 'draft',
    linkedIdeaId: c?.linked_idea_id && ctx.ideaIds.includes(c.linked_idea_id) ? c.linked_idea_id : null,
    linkedExperimentId:
      c?.linked_experiment_id && ctx.experimentIds.includes(c.linked_experiment_id) ? c.linked_experiment_id : null,
    createdAt: now,
    updatedAt: now,
  }

  const campaign: Campaign = {
    id: campaignId,
    name: manifest.campaign.name,
    description: manifest.campaign.description ?? '',
    contentId,
    createdAt: now,
    updatedAt: now,
  }

  const takenPlatformIds = [...ctx.platformContentIds]
  const platformContents: PlatformContent[] = manifest.platforms.map((p) => {
    const id = unique(p.id, takenPlatformIds)
    takenPlatformIds.push(id)

    const base: PlatformContent = {
      id,
      campaignId,
      platform: p.platform,
      format: p.format,
      status: p.status,
      schedule: {
        enabled: p.schedule.enabled,
        datetime: p.schedule.datetime,
        timezone: p.schedule.timezone,
      },
      publishedUrl: p.published_url,
      publishedAt: p.published_at,
      assets: p.assets.map((a) => ({
        asset_id: a.asset_id,
        filename: a.filename,
        type: a.type,
        reference: a.reference,
        provider: a.provider || 'local',
        role: a.role ?? null,
      })),
      createdAt: now,
      updatedAt: now,
    }

    const m = p.metadata
    switch (p.platform) {
      case 'instagram':
        return {
          ...base,
          instagram: {
            caption: (m.caption as string) ?? '',
            hashtags: Array.isArray(m.hashtags) ? (m.hashtags as string[]) : [],
            location: (m.location as string) ?? '',
          },
        }
      case 'youtube':
        return {
          ...base,
          youtube: {
            title: (m.title as string) ?? '',
            description: (m.description as string) ?? '',
            tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
          },
        }
      case 'linkedin':
        return { ...base, linkedin: { postText: (m.post_text as string) ?? '' } }
      case 'x': {
        const content = (m.content as string) ?? ''
        const isThread = m.is_thread === true
        const thread = Array.isArray(m.thread) ? (m.thread as string[]) : []
        return {
          ...base,
          x: {
            content: isThread && thread.length > 0 ? thread.join('\n\n') : content,
            isThread: isThread && thread.length > 0,
          },
        }
      }
    }
  })

  return { content, campaign, platformContents }
}

/* -------------------------------------------------------------------------- */
/*  Schema reference (embedded in the AI prompt & docs)                        */
/* -------------------------------------------------------------------------- */

export const MANIFEST_SCHEMA_FIELDS = [
  `Top level: schema_version (string, always "${MANIFEST_SCHEMA_VERSION}"), manifest_id (string), generated_at (ISO 8601), timezone (IANA name or null), brand { name, voice, handle } (strings or null), campaign {…}, platforms [ … ].`,
  `campaign: { id, name (non-empty string), description (string or null), content { id, title, concept, origin, audience, content_type, format, hook, draft, notes, status, linked_idea_id, linked_experiment_id } }.`,
  `content.origin must be one of: ${CONTENT_ORIGINS.join(', ')}.`,
  `content.content_type must be one of: ${CONTENT_TYPES.join(', ')}.`,
  `content.status and platform.status must be one of: ${PUBLISH_STATUSES.join(', ')}.`,
  `platforms[] entries: { platform, id, format, status, schedule { enabled, datetime, timezone }, published_url, published_at, assets [ … ], metadata { … } }.`,
  `platform must be one of: ${PLATFORM_KEYS.join(', ')}.`,
  `Allowed format per platform: ${PLATFORM_KEYS.map((k) => `${k} → ${PLATFORM_META[k].formats.join(' | ')}`).join('; ')}.`,
  `assets[] entries: { asset_id, filename, type, reference, provider, role }. type must be one of: ${ASSET_TYPES.join(', ')}. role is "video" | "thumbnail" | "media" | null. Assets are references only — never embed media bytes.`,
  `instagram metadata: { caption (string), hashtags (array of strings), location (string or null) }.`,
  `youtube metadata: { title (non-empty string), description (string), tags (array of strings) }.`,
  `linkedin metadata: { post_text (string) }.`,
  `x metadata: { content (string), is_thread (boolean), thread (array of strings or null — required as an array when is_thread is true) }.`,
  `schedule: enabled (boolean), datetime (ISO 8601 or null — required when enabled), timezone (IANA name or null).`,
].join('\n')

export const MANIFEST_SCHEMA_EXAMPLE = `{
  "schema_version": "${MANIFEST_SCHEMA_VERSION}",
  "manifest_id": "velgic-manifest-<campaign-id>",
  "generated_at": "2026-08-17T09:00:00Z",
  "timezone": "America/New_York",
  "brand": { "name": null, "voice": null, "handle": null },
  "campaign": {
    "id": "camp-01",
    "name": "Why AI agents get stuck in loops",
    "description": "One concept, four platforms.",
    "content": {
      "id": "content-01",
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
      "metadata": { "caption": "Your AI agent is not stuck — its memory is.", "hashtags": ["#ai", "#agents", "#buildinpublic"], "location": null }
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
      "metadata": { "title": "Why AI agents get stuck in loops", "description": "Context is the bottleneck — and how to fix it.", "tags": ["ai agents", "llm", "automation"] }
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
      "metadata": { "post_text": "Most agent failures are context failures. Here is the anatomy of the loop and three fixes." }
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
}`
