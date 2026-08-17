import type { Campaign, ContentItem, PlatformContent } from '../types'
import { PUBLISH_STATUS_META } from './constants'
import { MANIFEST_SCHEMA_EXAMPLE, MANIFEST_SCHEMA_FIELDS, MANIFEST_SCHEMA_VERSION } from './manifest'
import { formatSchedule } from './utils'

/**
 * Builds the copy-paste prompt for external AI tools (ChatGPT, Gemini, Claude,
 * Grok, …). No paid AI provider is called by Velgic itself — the user copies
 * the prompt, gets a Velgic Publishing Manifest back, and imports it.
 *
 * Placeholders ({{…}}) are left literal wherever Velgic doesn't have a value
 * yet, so the user knows exactly what to fill in.
 */

const RULES = [
  'Return ONLY valid JSON.',
  'Do not use markdown fences (no ```json … ``` wrappers).',
  'Do not provide explanations, commentary, or any text outside the JSON.',
  'Do not invent assets. Only reference the asset references provided below.',
  'Do not invent URLs. Use null when a published URL is unknown.',
  'Do not invent dates. Only use the schedule datetimes provided below.',
  'Use null for unavailable optional values.',
  'Follow the Velgic schema exactly — keep every required field and its type.',
  'Preserve provided asset references (asset_id, filename, type, reference) unchanged.',
  'Use valid ISO 8601 datetime values (e.g. 2026-08-20T09:00:00-04:00).',
  'Respect the requested platform and format values.',
]

export function buildPublishPrompt(args: {
  campaign: Campaign
  content: ContentItem | null
  platformContents: PlatformContent[]
}): string {
  const { campaign, content, platformContents } = args

  const lines: string[] = []
  lines.push('VELGIC PUBLISHING MANIFEST — AI GENERATION PROMPT')
  lines.push(`Schema version: ${MANIFEST_SCHEMA_VERSION}`)
  lines.push('Works with: ChatGPT, Gemini, Claude, Grok, or any AI tool.')
  lines.push('')
  lines.push('TASK')
  lines.push(
    'Generate a complete Velgic Publishing Manifest for the campaign below. Fill in any {{PLACEHOLDER}} values that are still needed, improve the provided text where asked, then output the finished manifest as JSON.',
  )
  lines.push('')
  lines.push('CONTEXT ({{PLACEHOLDER}} means: fill this in before sending)')
  lines.push('')

  const platforms = platformContents.length
    ? platformContents.map((pc) => `${pc.platform} (${pc.format})`).join(', ')
    : ''
  const formats = platformContents.length
    ? [...new Set(platformContents.map((pc) => pc.format))].join(', ')
    : ''
  const assets = platformContents
    .flatMap((pc) =>
      pc.assets.map(
        (a) =>
          `${a.reference} | filename=${a.filename} | type=${a.type} | asset_id=${a.asset_id} | role=${a.role ?? 'media'} | provider=${a.provider || 'local'} | mimeType=${a.mimeType ?? 'null'} | size=${a.size ?? 'null'} | duration=${a.duration ?? 'null'} | platform=${pc.platform}`,
      ),
    )
    .join('\n')
  const timezone = platformContents.find((pc) => pc.schedule.enabled && pc.schedule.timezone)?.schedule.timezone ?? ''
  // Include the exact ISO 8601 datetime so external AI tools can preserve it
  // verbatim (rules: "Do not invent dates", "Use valid ISO 8601 datetime values").
  const scheduleLines = platformContents
    .filter((pc) => pc.schedule.enabled && pc.schedule.datetime)
    .map(
      (pc) => `${pc.platform}: ${pc.schedule.datetime} (${formatSchedule(pc.schedule.datetime, pc.schedule.timezone)})`,
    )
    .join('\n')
  const publishedUrls = platformContents
    .filter((pc) => pc.publishedUrl)
    .map((pc) => `${pc.platform}: ${pc.publishedUrl}`)
    .join('\n')
  const hashtags = platformContents
    .flatMap((pc) => pc.instagram?.hashtags ?? [])
    .join(' ')
  const location = platformContents.find((pc) => (pc.instagram?.location ?? '').trim())?.instagram?.location ?? ''

  const context: Array<[string, string]> = [
    ['{{CONTENT_TITLE}}', content?.title ?? ''],
    ['{{CONTENT_CONCEPT}}', content?.concept ?? ''],
    ['{{CONTENT_ORIGIN}}', content?.origin ?? ''],
    ['{{CONTENT_TYPE}}', content?.contentType ?? ''],
    ['{{CONTENT_FORMAT}}', content?.format ?? ''],
    ['{{HOOK}}', content?.hook ?? ''],
    ['{{TARGET_AUDIENCE}}', content?.audience ?? ''],
    ['{{CONTENT_STATUS}}', content?.status ?? ''],
    ['{{BRAND_VOICE}}', ''],
    ['{{PLATFORMS}}', platforms],
    ['{{FORMATS}}', formats],
    ['{{ASSETS}}', assets],
    ['{{TIMEZONE}}', timezone],
    ['{{SCHEDULE}}', scheduleLines],
    ['{{PUBLISHED_URL}}', publishedUrls],
    ['{{HASHTAGS}}', hashtags],
    ['{{LOCATION}}', location],
  ]
  for (const [key, value] of context) {
    lines.push(`${key}: ${value.trim() ? value : key}`)
  }
  lines.push('')
  lines.push(`CAMPAIGN NAME: ${campaign.name || '{{CAMPAIGN_NAME}}'}`)
  lines.push(`CAMPAIGN STATUS: ${campaign.status || '{{CAMPAIGN_STATUS}}'}`)
  if (campaign.description) lines.push(`CAMPAIGN DESCRIPTION: ${campaign.description}`)

  // Current platform text, so the AI can preserve/improve rather than invent.
  if (platformContents.length) {
    lines.push('')
    lines.push('EXISTING PLATFORM TEXT (preserve or improve — do not discard)')
    for (const pc of platformContents) {
      lines.push('')
      lines.push(`[${pc.platform} · ${pc.format} · ${PUBLISH_STATUS_META[pc.status].label}]`)
      if (pc.instagram) {
        if (pc.instagram.caption) lines.push(`caption: ${pc.instagram.caption}`)
        if (pc.instagram.hashtags.length) lines.push(`hashtags: ${pc.instagram.hashtags.join(' ')}`)
        if (pc.instagram.location) lines.push(`location: ${pc.instagram.location}`)
      }
      if (pc.youtube) {
        if (pc.youtube.title) lines.push(`title: ${pc.youtube.title}`)
        if (pc.youtube.description) lines.push(`description: ${pc.youtube.description}`)
        if (pc.youtube.tags.length) lines.push(`tags: ${pc.youtube.tags.join(', ')}`)
      }
      if (pc.linkedin?.postText) lines.push(`post: ${pc.linkedin.postText}`)
      if (pc.x?.content) {
        lines.push(`post/thread:`)
        lines.push(pc.x.content)
      }
    }
  }

  lines.push('')
  lines.push('RULES')
  RULES.forEach((r, i) => lines.push(`${i + 1}. ${r}`))
  lines.push('')
  lines.push('VELGIC PUBLISHING MANIFEST SCHEMA (follow exactly)')
  lines.push(MANIFEST_SCHEMA_FIELDS)
  lines.push('')
  lines.push('NOTE: The EXAMPLE below shows the exact shape and key names only — DO NOT copy its values. Fill every value from the CONTEXT and EXISTING PLATFORM TEXT sections above.')
  lines.push('EXAMPLE (match this shape and key names exactly)')
  lines.push(MANIFEST_SCHEMA_EXAMPLE)

  return lines.join('\n')
}
