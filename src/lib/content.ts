import type { AssetRef, ContentItem, ContentTypeKey, PlatformContent, PlatformKey, PublishStatus } from '../types'
import { PLATFORM_META } from './constants'
import { nowIso, uid } from './utils'

/* -------------------------------------------------------------------------- */
/*  Platform suggestions per content type                                      */
/* -------------------------------------------------------------------------- */

const CONTENT_TYPE_PLATFORMS: Record<ContentTypeKey, PlatformKey[]> = {
  reel: ['instagram'],
  carousel: ['instagram', 'linkedin'],
  short_video: ['instagram', 'youtube'],
  linkedin_post: ['linkedin'],
  x_post: ['x'],
  x_thread: ['x'],
  youtube_short: ['youtube'],
  youtube_video: ['youtube'],
  article: ['linkedin', 'x'],
  tutorial: ['youtube', 'linkedin'],
}

/** Default platform set when a campaign is created from a content type. */
export function suggestedPlatforms(contentType: ContentTypeKey): PlatformKey[] {
  return CONTENT_TYPE_PLATFORMS[contentType] ?? []
}

/** Sensible platform format for a given platform + content type. */
export function defaultPlatformFormat(platform: PlatformKey, contentType: ContentTypeKey | null): string {
  if (contentType) {
    if (platform === 'instagram') return contentType === 'carousel' ? 'Carousel' : 'Reel'
    if (platform === 'youtube') return contentType === 'youtube_video' || contentType === 'tutorial' ? 'Video' : 'Short'
    if (platform === 'linkedin') return contentType === 'article' ? 'Article' : 'Post'
    if (platform === 'x') return contentType === 'x_thread' ? 'Thread' : 'Post'
  }
  return PLATFORM_META[platform].defaultFormat
}

const IDEA_FORMAT_TO_CONTENT_TYPE: Record<string, ContentTypeKey> = {
  Article: 'article',
  Video: 'youtube_video',
  'Short-form video': 'short_video',
  Thread: 'x_thread',
  Tutorial: 'tutorial',
  Demo: 'short_video',
  Carousel: 'carousel',
  'LinkedIn post': 'linkedin_post',
  Newsletter: 'article',
  Podcast: 'article',
}

/** Best-fit content type for an existing idea format. */
export function ideaFormatToContentType(format: string): ContentTypeKey {
  return IDEA_FORMAT_TO_CONTENT_TYPE[format] ?? 'article'
}

/* -------------------------------------------------------------------------- */
/*  Platform content factory                                                   */
/* -------------------------------------------------------------------------- */

export function blankPlatformContent(
  campaignId: string,
  platform: PlatformKey,
  contentType: ContentTypeKey | null,
): PlatformContent {
  const now = nowIso()
  const base: PlatformContent = {
    id: uid(),
    campaignId,
    platform,
    format: defaultPlatformFormat(platform, contentType),
    status: 'draft',
    schedule: { enabled: false, datetime: null, timezone: null },
    publishedUrl: null,
    publishedAt: null,
    assets: [],
    createdAt: now,
    updatedAt: now,
  }
  switch (platform) {
    case 'instagram':
      return { ...base, instagram: { caption: '', hashtags: [], location: '' } }
    case 'youtube':
      return { ...base, youtube: { title: '', description: '', tags: [] } }
    case 'linkedin':
      return { ...base, linkedin: { postText: '' } }
    case 'x':
      return { ...base, x: { content: '', isThread: false } }
  }
}

/** Generate a readable, platform-scoped asset id like "instagram-reel-01". */
export function nextAssetId(platform: PlatformKey, role: string, existing: AssetRef[]): string {
  const prefix = `${platform}-${role}`
  const existingCount = existing.filter((a) => a.asset_id.startsWith(prefix)).length
  return `${prefix}-${String(existingCount + 1).padStart(2, '0')}`
}

export function blankAssetRef(platform: PlatformKey, role: string, existing: AssetRef[]): AssetRef {
  return {
    asset_id: nextAssetId(platform, role, existing),
    filename: '',
    type: 'video',
    reference: '',
    provider: 'local',
    role,
  }
}

/* -------------------------------------------------------------------------- */
/*  Copy targets (lifecycle actions)                                           */
/* -------------------------------------------------------------------------- */

/** The primary text block of a platform version. */
export function platformPrimaryText(pc: PlatformContent): string {
  switch (pc.platform) {
    case 'instagram': {
      const m = pc.instagram
      if (!m) return ''
      return [m.caption, m.hashtags.length ? m.hashtags.join(' ') : ''].filter(Boolean).join('\n\n')
    }
    case 'youtube': {
      const m = pc.youtube
      if (!m) return ''
      return [m.title, m.description, m.tags.length ? m.tags.join(', ') : ''].filter(Boolean).join('\n\n')
    }
    case 'linkedin':
      return pc.linkedin?.postText ?? ''
    case 'x':
      return pc.x?.content ?? ''
  }
}

/** The caption-equivalent of a platform version (shortest usable text). */
export function platformCaptionText(pc: PlatformContent): string {
  switch (pc.platform) {
    case 'instagram':
      return pc.instagram?.caption ?? ''
    case 'youtube':
      return pc.youtube?.title ?? ''
    case 'linkedin':
      return pc.linkedin?.postText ?? ''
    case 'x': {
      const content = pc.x?.content ?? ''
      return content.split(/\n\s*\n/)[0] ?? content
    }
  }
}

/* -------------------------------------------------------------------------- */
/*  Publishing readiness                                                       */
/* -------------------------------------------------------------------------- */

export interface ReadinessCheck {
  label: string
  done: boolean
  required: boolean
}

/**
 * Publishing-readiness checks for a platform version. Required items gate the
 * Ready state; recommended items are best practice but don't block.
 */
export function platformReadiness(pc: PlatformContent): { checks: ReadinessCheck[]; pct: number; ready: boolean } {
  const checks: ReadinessCheck[] = []
  const required = (label: string, done: boolean) => checks.push({ label, done, required: true })
  const recommended = (label: string, done: boolean) => checks.push({ label, done, required: false })

  switch (pc.platform) {
    case 'instagram': {
      required('Caption', (pc.instagram?.caption ?? '').trim().length > 0)
      required('Asset', pc.assets.length > 0)
      recommended('Hashtags', (pc.instagram?.hashtags ?? []).length > 0)
      recommended('Location', (pc.instagram?.location ?? '').trim().length > 0)
      break
    }
    case 'youtube': {
      required('Title', (pc.youtube?.title ?? '').trim().length > 0)
      required('Video asset', pc.assets.some((a) => a.role === 'video' || a.type === 'video'))
      recommended('Description', (pc.youtube?.description ?? '').trim().length > 0)
      recommended('Thumbnail', pc.assets.some((a) => a.role === 'thumbnail'))
      recommended('Tags', (pc.youtube?.tags ?? []).length > 0)
      break
    }
    case 'linkedin': {
      required('Post text', (pc.linkedin?.postText ?? '').trim().length > 0)
      recommended('Media', pc.assets.length > 0)
      break
    }
    case 'x': {
      required('Post content', (pc.x?.content ?? '').trim().length > 0)
      recommended('Media', pc.assets.length > 0)
      break
    }
  }

  if (pc.status === 'scheduled') required('Schedule set', pc.schedule.enabled && !!pc.schedule.datetime)
  else recommended('Schedule', pc.schedule.enabled && !!pc.schedule.datetime)
  if (pc.status === 'published') required('Published URL', !!pc.publishedUrl)
  else recommended('Published URL', !!pc.publishedUrl)

  const doneCount = checks.filter((c) => c.done).length
  const ready = checks.filter((c) => c.required).every((c) => c.done)
  return { checks, pct: checks.length ? Math.round((doneCount / checks.length) * 100) : 0, ready }
}

/** Overall readiness percentage across a campaign's platform versions. */
export function campaignReadiness(pcs: PlatformContent[]): number | null {
  if (pcs.length === 0) return null
  const pcts = pcs.map((pc) => platformReadiness(pc).pct)
  return Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length)
}

/** Next scheduled datetime across platform versions (soonest in the future). */
export function nextScheduled(pcs: PlatformContent[]): { pc: PlatformContent; datetime: string } | null {
  const now = Date.now()
  let best: { pc: PlatformContent; datetime: string } | null = null
  for (const pc of pcs) {
    if (!pc.schedule.enabled || !pc.schedule.datetime || pc.status === 'published') continue
    const t = new Date(pc.schedule.datetime).getTime()
    if (Number.isNaN(t) || t < now) continue
    if (!best || t < new Date(best.datetime).getTime()) best = { pc, datetime: pc.schedule.datetime }
  }
  return best
}

/* -------------------------------------------------------------------------- */
/*  Misc                                                                       */
/* -------------------------------------------------------------------------- */

export type ContentStatusTone = 'neutral' | 'accent' | 'violet' | 'green' | 'red'

export function publishStatusTone(status: PublishStatus): ContentStatusTone {
  switch (status) {
    case 'draft':
      return 'neutral'
    case 'ready':
      return 'accent'
    case 'scheduled':
      return 'violet'
    case 'published':
      return 'green'
    case 'failed':
      return 'red'
  }
}
