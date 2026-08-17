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
