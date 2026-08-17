import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { computeInsights } from '../lib/insights'
import { formatNumber } from '../lib/utils'
import { Card, CardHeader, EmptyState } from '../components/ui'
import { IconChart, IconFlask } from '../components/icons'

function BarList({ data, tone = 'accent', format = formatNumber }: { data: { label: string; value: number }[]; tone?: 'accent' | 'green' | 'red'; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div className="bar-list">
      {data.map((d) => (
        <div key={d.label} className="bar-item">
          <div className="bar-item__top">
            <span className="bar-item__label">{d.label}</span>
            <span className="bar-item__value">{format(d.value)}</span>
          </div>
          <div className="bar-item__track">
            <div className={`bar-item__fill bar-item__fill--${tone}`} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Insights() {
  const items = useStore((s) => s.items)
  const experiments = useStore((s) => s.experiments)
  const openExperimentEditor = useUI((s) => s.openExperimentEditor)

  const insights = useMemo(() => computeInsights(items, experiments), [items, experiments])
  const hasData = insights.publishedCount > 0

  if (!hasData) {
    return (
      <Card>
        <EmptyState
          icon={<IconChart size={20} />}
          title="Not enough data yet"
          hint="Publish some content and add performance numbers to surface patterns here."
        />
      </Card>
    )
  }

  return (
    <div className="stack">
      <div className="insight-stats">
        <div className="stat">
          <span className="stat__label">Published</span>
          <span className="stat__value">{insights.publishedCount}</span>
          <span className="stat__sub">records with data</span>
        </div>
        <div className="stat">
          <span className="stat__label">Total views</span>
          <span className="stat__value">{formatNumber(insights.totalViews)}</span>
          <span className="stat__sub">across everything</span>
        </div>
        <div className="stat">
          <span className="stat__label">Avg views</span>
          <span className="stat__value">{formatNumber(insights.avgViews)}</span>
          <span className="stat__sub">per piece</span>
        </div>
        <div className="stat">
          <span className="stat__label">Avg engagement</span>
          <span className="stat__value">{insights.avgEngagementRate.toFixed(1)}%</span>
          <span className="stat__sub">likes + comments + shares + saves</span>
        </div>
      </div>

      <div className="dash-grid">
        <div className="col-6">
          <Card>
            <CardHeader title="Best performing topics" meta="Total views by category." />
            <BarList data={insights.topTopics} tone="green" />
          </Card>
        </div>
        <div className="col-6">
          <Card>
            <CardHeader title="Best formats" meta="Total views by content format." />
            <BarList data={insights.topFormats} />
          </Card>
        </div>

        <div className="col-7">
          <Card>
            <CardHeader title="Best hooks" meta="Your highest-view hooks, ranked." />
            {insights.topHooks.length === 0 ? (
              <p className="empty__hint">Add hooks to published items to see them ranked here.</p>
            ) : (
              <div className="hook-list">
                {insights.topHooks.map((h) => (
                  <div key={h.id} className="hook-item">
                    <div className="hook-item__hook">“{h.hook.split('\n')[0].slice(0, 140)}”</div>
                    <div className="hook-item__meta">
                      <Link to={`/items/${h.id}`} className="inline-link">
                        {h.title}
                      </Link>
                      <span>
                        {formatNumber(h.views)} views · {h.engagementRate.toFixed(1)}% engagement
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-5">
          <Card>
            <CardHeader title="Average performance" meta="Per published piece." />
            <BarList
              data={[
                { label: 'Views', value: insights.avgViews },
                { label: 'Likes', value: insights.avgLikes },
                { label: 'Comments', value: insights.avgComments },
              ]}
              tone="accent"
            />
            <p className="empty__hint" style={{ marginTop: 12 }}>
              Engagement rate: {insights.avgEngagementRate.toFixed(1)}% of viewers interact.
            </p>
          </Card>
        </div>

        <div className="col-6">
          <Card>
            <CardHeader
              title="Experiments worth repeating"
              meta="Flagged as repeatable wins."
              actions={<IconFlask size={15} style={{ color: 'var(--text-faint)' }} />}
            />
            {insights.repeatExperiments.length === 0 ? (
              <p className="empty__hint">Mark experiments as “worth repeating” to promote them here.</p>
            ) : (
              <div className="row-list">
                {insights.repeatExperiments.map((e) => (
                  <button key={e.id} className="row-item row-item--clickable" onClick={() => openExperimentEditor(e)}>
                    <div className="row-item__main">
                      <div className="row-item__title">{e.name}</div>
                      <div className="row-item__sub">{e.keyLearning || e.result}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="col-6">
          <Card>
            <CardHeader title="Topics that underperformed" meta="Below your average view count — investigate or retire." />
            {insights.underperforming.length === 0 ? (
              <p className="empty__hint">Nothing underperforming — everything is at or above average.</p>
            ) : (
              <BarList data={insights.underperforming} tone="red" />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
