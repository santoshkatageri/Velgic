import type { Priority, Stage, ExperimentStatus, ExperimentOutcome } from '../types'

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
