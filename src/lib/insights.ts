import type { Item, Experiment } from '../types'

export interface NamedStat {
  label: string
  value: number
}

export interface HookStat {
  id: string
  title: string
  hook: string
  views: number
  engagementRate: number
}

export interface Insights {
  publishedCount: number
  totalViews: number
  avgViews: number
  avgEngagementRate: number
  avgLikes: number
  avgComments: number
  topTopics: NamedStat[]
  topFormats: NamedStat[]
  topHooks: HookStat[]
  underperforming: NamedStat[]
  repeatExperiments: Experiment[]
}

export function engagementRate(item: Item): number {
  const p = item.performance
  if (!p || p.views <= 0) return 0
  return ((p.likes + p.comments + p.shares + p.saves) / p.views) * 100
}

export function computeInsights(items: Item[], experiments: Experiment[]): Insights {
  const published = items.filter((i) => i.stage === 'published' && i.performance)

  const totalViews = published.reduce((sum, i) => sum + (i.performance?.views ?? 0), 0)
  const avgViews = published.length ? Math.round(totalViews / published.length) : 0
  const avgEngagementRate = published.length
    ? published.reduce((sum, i) => sum + engagementRate(i), 0) / published.length
    : 0
  const avgLikes = published.length
    ? Math.round(published.reduce((sum, i) => sum + (i.performance?.likes ?? 0), 0) / published.length)
    : 0
  const avgComments = published.length
    ? Math.round(published.reduce((sum, i) => sum + (i.performance?.comments ?? 0), 0) / published.length)
    : 0

  const groupBy = (key: (i: Item) => string): Record<string, number> => {
    const map: Record<string, number> = {}
    for (const i of published) {
      const k = key(i) || 'Uncategorized'
      map[k] = (map[k] ?? 0) + (i.performance?.views ?? 0)
    }
    return map
  }

  const topics = groupBy((i) => i.category)
  const formats = groupBy((i) => i.format)

  const topTopics = Object.entries(topics)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  const topFormats = Object.entries(formats)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }))

  const topHooks: HookStat[] = published
    .filter((i) => i.hook.trim().length > 0 && (i.performance?.views ?? 0) > 0)
    .map((i) => ({
      id: i.id,
      title: i.title,
      hook: i.hook,
      views: i.performance?.views ?? 0,
      engagementRate: engagementRate(i),
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 3)

  // Topics with below-average views, ascending (worst first).
  const underperforming = Object.entries(topics)
    .filter(([, value]) => value < avgViews || (avgViews === 0 && value === 0))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => a.value - b.value)
    .slice(0, 3)

  const repeatExperiments = experiments.filter((e) => e.worthRepeating)

  return {
    publishedCount: published.length,
    totalViews,
    avgViews,
    avgEngagementRate,
    avgLikes,
    avgComments,
    topTopics,
    topFormats,
    topHooks,
    underperforming,
    repeatExperiments,
  }
}
