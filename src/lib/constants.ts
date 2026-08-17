import type {
  Priority,
  Stage,
  ExperimentStatus,
  ExperimentOutcome,
  ContentOrigin,
  ContentTypeKey,
  PublishStatus,
  PlatformKey,
  AssetType,
} from '../types'

export const CATEGORIES = [
  'AI',
  'Engineering',
  'Automation',
  'SaaS',
  'Web Apps',
  'Developer Tools',
  'Creator Workflows',
  'Experiments',
] as const

export const FORMATS = [
  'Article',
  'Video',
  'Short-form video',
  'Thread',
  'Tutorial',
  'Demo',
  'Carousel',
  'LinkedIn post',
  'Newsletter',
  'Podcast',
] as const

export const AUDIENCES = [
  'Developers',
  'Indie hackers',
  'Founders',
  'Engineering managers',
  'AI builders',
  'Technical creators',
  'General tech',
] as const

export const STAGES: Stage[] = ['ideas', 'research', 'script', 'production', 'published']

export const STAGE_META: Record<Stage, { label: string; blurb: string }> = {
  ideas: { label: 'Ideas', blurb: 'Raw, unfiltered possibilities' },
  research: { label: 'Research', blurb: 'Validating the angle' },
  script: { label: 'Script', blurb: 'Writing the narrative' },
  production: { label: 'Production', blurb: 'Recording & building' },
  published: { label: 'Published', blurb: 'Shipped and measured' },
}

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']

export const PRIORITY_META: Record<Priority, { label: string }> = {
  low: { label: 'Low' },
  medium: { label: 'Medium' },
  high: { label: 'High' },
}

export const EXPERIMENT_STATUSES: ExperimentStatus[] = ['planned', 'running', 'done']

export const EXPERIMENT_STATUS_META: Record<ExperimentStatus, { label: string }> = {
  planned: { label: 'Planned' },
  running: { label: 'Running' },
  done: { label: 'Done' },
}

export const EXPERIMENT_OUTCOMES: ExperimentOutcome[] = ['success', 'mixed', 'failed']

export const EXPERIMENT_OUTCOME_META: Record<ExperimentOutcome, { label: string }> = {
  success: { label: 'Success' },
  mixed: { label: 'Mixed' },
  failed: { label: 'Failed' },
}

// Category color tokens (resolved in CSS via data attributes).
export const CATEGORY_COLORS: Record<string, string> = {
  AI: 'violet',
  Engineering: 'sky',
  Automation: 'cyan',
  SaaS: 'pink',
  'Web Apps': 'emerald',
  'Developer Tools': 'amber',
  'Creator Workflows': 'rose',
  Experiments: 'lime',
}

export const EFFORT_LABELS: Record<number, string> = {
  1: 'Quick',
  2: 'Light',
  3: 'Moderate',
  4: 'Heavy',
  5: 'Deep',
}

/* -------------------------------------------------------------------------- */
/*  V2 — Content & publishing constants                                        */
/* -------------------------------------------------------------------------- */

export const CONTENT_TYPES: ContentTypeKey[] = [
  'reel',
  'carousel',
  'short_video',
  'linkedin_post',
  'x_post',
  'x_thread',
  'youtube_short',
  'youtube_video',
  'article',
  'tutorial',
]

export const CONTENT_TYPE_META: Record<ContentTypeKey, { label: string; hint: string }> = {
  reel: { label: 'Reel', hint: 'Short vertical video for Instagram' },
  carousel: { label: 'Carousel', hint: 'Swipeable multi-slide post' },
  short_video: { label: 'Short video', hint: 'Short-form vertical video, any platform' },
  linkedin_post: { label: 'LinkedIn post', hint: 'Text-first professional post' },
  x_post: { label: 'X post', hint: 'Single post on X' },
  x_thread: { label: 'X thread', hint: 'Multi-post thread on X' },
  youtube_short: { label: 'YouTube Short', hint: 'Vertical video under 60s' },
  youtube_video: { label: 'YouTube video', hint: 'Long-form video' },
  article: { label: 'Article', hint: 'Long-form written piece' },
  tutorial: { label: 'Tutorial', hint: 'Step-by-step how-to' },
}

export const CONTENT_ORIGINS: ContentOrigin[] = [
  'idea',
  'experiment',
  'research',
  'observation',
  'opinion',
  'trend',
  'personal_experience',
  'direct',
]

export const CONTENT_ORIGIN_META: Record<ContentOrigin, { label: string; hint: string }> = {
  idea: { label: 'Idea', hint: 'Born from an idea in your inbox' },
  experiment: { label: 'Experiment', hint: 'Born from something you tested' },
  research: { label: 'Research', hint: 'From research or reading' },
  observation: { label: 'Observation', hint: 'Something you noticed' },
  opinion: { label: 'Opinion', hint: 'A take you want to share' },
  trend: { label: 'Trend', hint: 'Responding to a trend' },
  personal_experience: { label: 'Personal experience', hint: 'From your own lived experience' },
  direct: { label: 'Direct content idea', hint: 'A standalone content concept' },
}

export const PUBLISH_STATUSES: PublishStatus[] = ['draft', 'ready', 'scheduled', 'published', 'failed']

export const PUBLISH_STATUS_META: Record<PublishStatus, { label: string }> = {
  draft: { label: 'Draft' },
  ready: { label: 'Ready' },
  scheduled: { label: 'Scheduled' },
  published: { label: 'Published' },
  failed: { label: 'Failed' },
}

export const PLATFORM_KEYS: PlatformKey[] = ['instagram', 'youtube', 'linkedin', 'x']

export const PLATFORM_META: Record<
  PlatformKey,
  { label: string; composerUrl: string; formats: string[]; defaultFormat: string; hint: string }
> = {
  instagram: {
    label: 'Instagram',
    composerUrl: 'https://www.instagram.com/',
    formats: ['Reel', 'Carousel', 'Post', 'Story', 'Video'],
    defaultFormat: 'Reel',
    hint: 'Asset, caption, hashtags, location',
  },
  youtube: {
    label: 'YouTube',
    composerUrl: 'https://studio.youtube.com/',
    formats: ['Short', 'Video', 'Live'],
    defaultFormat: 'Short',
    hint: 'Video + thumbnail assets, title, description, tags',
  },
  linkedin: {
    label: 'LinkedIn',
    composerUrl: 'https://www.linkedin.com/feed/',
    formats: ['Post', 'Article', 'Carousel', 'Video', 'Newsletter'],
    defaultFormat: 'Post',
    hint: 'Post text, media assets',
  },
  x: {
    label: 'X (Twitter)',
    composerUrl: 'https://x.com/compose/post',
    formats: ['Post', 'Thread'],
    defaultFormat: 'Post',
    hint: 'Post / thread content, media assets',
  },
}

export const ASSET_TYPES: AssetType[] = ['video', 'image', 'audio', 'document', 'link']

export const ASSET_TYPE_META: Record<AssetType, { label: string }> = {
  video: { label: 'Video' },
  image: { label: 'Image' },
  audio: { label: 'Audio' },
  document: { label: 'Document' },
  link: { label: 'Link' },
}
