import type { Item } from '../types'
import { opportunityScore, recommendationScore, REUSABLE_BONUS, strongestDimension, effortLabel } from './scoring'

export interface Recommendation {
  item: Item
  score: number // raw opportunity score (0–40)
  total: number // including reusable bonus
  bonus: number
  strongest: string
  reasons: string[]
}

export function getRecommendation(items: Item[], dismissed: string[]): Recommendation | null {
  const candidates = items.filter((i) => i.stage !== 'published')
  if (candidates.length === 0) return null

  const ranked = [...candidates].sort(
    (a, b) => recommendationScore(b) - recommendationScore(a) || opportunityScore(b.scores) - opportunityScore(a.scores),
  )

  let pick = ranked.find((i) => !dismissed.includes(i.id))
  if (!pick) pick = ranked[0]

  const score = opportunityScore(pick.scores)
  const bonus = pick.reusable ? REUSABLE_BONUS : 0
  const strong = strongestDimension(pick.scores)

  const reasons: string[] = [
    `Opportunity score ${score}/40 — strongest on ${strong.label.toLowerCase()} (${strong.value}/10).`,
    pick.reusable
      ? `Reusable across multiple formats, so one build can feed several pieces of content (+${bonus}).`
      : `Solid single-format play for ${pick.audience.toLowerCase()}.`,
    `${effortLabel(pick.estimatedEffort)} (${pick.estimatedEffort}/5) for an estimated ${pick.potentialImpact}/10 potential impact.`,
  ]

  return {
    item: pick,
    score,
    total: recommendationScore(pick),
    bonus,
    strongest: strong.label,
    reasons,
  }
}
