export type Stage = 'ideas' | 'research' | 'script' | 'production' | 'published'

export type Priority = 'low' | 'medium' | 'high'

export type ExperimentStatus = 'planned' | 'running' | 'done'

export type ExperimentOutcome = 'success' | 'mixed' | 'failed'

export interface ScoreSet {
  audienceValue: number
  novelty: number
  personalRelevance: number
  easeOfExecution: number
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface PerformanceRecord {
  publishedAt: string
  platform: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
}

export interface Item {
  id: string
  title: string
  problem: string
  category: string
  audience: string
  format: string
  estimatedEffort: number // 1–5
  potentialImpact: number // 1–10
  reusable: boolean
  stage: Stage
  priority: Priority
  notes: string
  scores: ScoreSet

  // Content detail sections
  coreIdea: string
  hook: string
  audienceProblem: string
  keyInsight: string
  script: string
  visualPlan: string
  productionNotes: string
  linkedInPost: string
  instagramCaption: string
  checklist: ChecklistItem[]
  performance: PerformanceRecord | null
  lessonsLearned: string

  createdAt: string
  updatedAt: string
}

export interface Metric {
  label: string
  value: string
}

export interface Experiment {
  id: string
  name: string
  status: ExperimentStatus
  outcome: ExperimentOutcome
  hypothesis: string
  whatWasBuilt: string
  tools: string
  timeSpent: string
  result: string
  metrics: Metric[]
  whatWorked: string
  whatFailed: string
  keyLearning: string
  followUpIdea: string
  worthRepeating: boolean
  createdAt: string
  updatedAt: string
}

/* -------------------------------------------------------------------------- */
/*  V2 — Content + multi-platform publishing                                   */
/* -------------------------------------------------------------------------- */

/** Where a content concept came from. */
export type ContentOrigin =
  | 'idea'
  | 'experiment'
  | 'research'
  | 'observation'
  | 'opinion'
  | 'trend'
  | 'personal_experience'
  | 'direct'

/** First-class content types. */
export type ContentTypeKey =
  | 'reel'
  | 'carousel'
  | 'short_video'
  | 'linkedin_post'
  | 'x_post'
  | 'x_thread'
  | 'youtube_short'
  | 'youtube_video'
  | 'article'
  | 'tutorial'

/** Publishing lifecycle shared by platform versions (independent per platform). */
export type PublishStatus = 'draft' | 'ready' | 'scheduled' | 'published' | 'failed'

/** Content concept status — separate from the Pipeline stages by design. */
export type ContentStatus = 'draft' | 'in_production' | 'ready' | 'published' | 'archived'

/** Campaign distribution status — separate from Content and Pipeline status. */
export type CampaignStatus = 'draft' | 'ready' | 'partially_published' | 'published' | 'archived'

/** Supported publishing platforms (extensible — see PLATFORM_META). */
export type PlatformKey = 'instagram' | 'youtube' | 'linkedin' | 'x'

export type AssetType = 'video' | 'image' | 'audio' | 'document' | 'link'

/**
 * An asset is never embedded in JSON — only referenced. `reference` is a path
 * understood by the active StorageProvider (local paths in V2; Google Drive /
 * Cloudflare R2 providers can be plugged in later). Assets live in a reusable
 * asset library; platform versions reference them by `asset_id`.
 *
 * `createdAt` / `notes` are library-level fields (normalized on entry to the
 * library) and are intentionally NOT part of the Publishing Manifest.
 */
export interface AssetRef {
  asset_id: string
  filename: string
  type: AssetType
  reference: string
  provider: string
  /** Platform role: 'video' | 'thumbnail' | 'media' | null. */
  role: string | null
  /** Optional technical metadata — never required, never embedded media. */
  mimeType?: string | null
  /** Size in bytes. */
  size?: number | null
  /** Duration in seconds (video/audio). */
  duration?: number | null
  createdAt?: string
  notes?: string
}

/** Optional manual metrics retained per published platform version for future Insights. */
export interface PlatformMetrics {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}

export interface ScheduleInfo {
  enabled: boolean
  /** ISO 8601 datetime, or null when unset. */
  datetime: string | null
  /** IANA timezone name, e.g. "America/New_York". */
  timezone: string | null
}

export interface InstagramMetadata {
  caption: string
  hashtags: string[]
  location: string
}

export interface YoutubeMetadata {
  title: string
  description: string
  tags: string[]
}

export interface LinkedInMetadata {
  postText: string
}

export interface XMetadata {
  /** Full post or thread text (blank line separates posts in a thread). */
  content: string
  isThread: boolean
}

/** One platform version of a campaign. Independently editable. */
export interface PlatformContent {
  id: string
  campaignId: string
  platform: PlatformKey
  format: string
  status: PublishStatus
  schedule: ScheduleInfo
  publishedUrl: string | null
  publishedAt: string | null
  assets: AssetRef[]
  notes: string
  /** Optional manual metrics (not ingested automatically in 2.x). */
  metrics?: PlatformMetrics | null
  instagram?: InstagramMetadata
  youtube?: YoutubeMetadata
  linkedin?: LinkedInMetadata
  x?: XMetadata
  createdAt: string
  updatedAt: string
}

/** A first-class content concept. Independent of ideas and experiments. */
export interface ContentItem {
  id: string
  title: string
  concept: string
  origin: ContentOrigin
  audience: string
  contentType: ContentTypeKey
  format: string
  hook: string
  draft: string
  notes: string
  status: ContentStatus
  linkedIdeaId: string | null
  linkedExperimentId: string | null
  createdAt: string
  updatedAt: string
}

/** A multi-platform distribution plan for one content concept. */
export interface Campaign {
  id: string
  name: string
  description: string
  contentId: string
  /** Platform keys this campaign distributes to (mirrored from its platform versions). */
  platforms: PlatformKey[]
  status: CampaignStatus
  createdAt: string
  updatedAt: string
}
