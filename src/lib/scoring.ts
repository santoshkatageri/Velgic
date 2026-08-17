import type { Item, ScoreSet } from '../types'

export const SCORE_DIMENSIONS: Array<{ key: keyof ScoreSet; label: string; hint: string }> = [
  { key: 'audienceValue', label: 'Audience value', hint: 'How much this helps your audience' },
  { key: 'novelty', label: 'Novelty', hint: 'How fresh or differentiated the angle is' },
  { key: 'personalRelevance', label: 'Personal relevance', hint: 'How aligned with your niche' },
  { key: 'easeOfExecution', label: 'Ease of execution', hint: 'How cheaply you can ship it' },
]

export const REUSABLE_BONUS = 4

/** Raw opportunity score = sum of the four 1–10 dimensions (max 40). */
export function opportunityScore(scores: ScoreSet): number {
  return scores.audienceValue + scores.novelty + scores.personalRelevance + scores.easeOfExecution
}

/** Recommendation score adds a bonus for ideas that can be reused across formats. */
export function recommendationScore(item: Item): number {
  return opportunityScore(item.scores) + (item.reusable ? REUSABLE_BONUS : 0)
}

export function strongestDimension(scores: ScoreSet): { key: keyof ScoreSet; label: string; value: number } {
  const dims = SCORE_DIMENSIONS.map((d) => ({ ...d, value: scores[d.key] }))
  return dims.reduce((best, d) => (d.value > best.value ? d : best), dims[0])
}

export function effortLabel(effort: number): string {
  switch (effort) {
    case 1:
      return 'Quick win'
    case 2:
      return 'Light lift'
    case 3:
      return 'Moderate effort'
    case 4:
      return 'Heavy effort'
    case 5:
      return 'Deep project'
    default:
      return 'Unknown'
  }
}
