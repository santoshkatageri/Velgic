import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { getRecommendation } from '../lib/recommend'
import { opportunityScore } from '../lib/scoring'
import { EFFORT_LABELS, STAGES, STAGE_META } from '../lib/constants'
import { CATEGORIES } from '../lib/constants'
import { uid, nowIso, formatNumber, timeAgo } from '../lib/utils'
import { Button, Card, CardHeader, Badge, CategoryBadge, Select, Textarea } from '../components/ui'
import { IconSparkle, IconCapture, IconBolt, IconCheck, IconChevronRight, IconFlask } from '../components/icons'
import type { Item } from '../types'

export function Dashboard() {
  const items = useStore((s) => s.items)
  const experiments = useStore((s) => s.experiments)
  const dismissed = useStore((s) => s.dismissed)
  const dismiss = useStore((s) => s.dismiss)
  const addItem = useStore((s) => s.addItem)
  const openEditor = useUI((s) => s.openEditor)
  const openExperimentEditor = useUI((s) => s.openExperimentEditor)
  const navigate = useNavigate()

  const reco = useMemo(() => getRecommendation(items, dismissed), [items, dismissed])

  const inboxCount = items.filter((i) => i.stage === 'ideas').length
  const pipelineCount = items.filter((i) => ['research', 'script', 'production'].includes(i.stage)).length
  const publishedCount = items.filter((i) => i.stage === 'published').length
  const totalViews = items.reduce((sum, i) => sum + (i.performance?.views ?? 0), 0)
  const avgScore = inboxCount
    ? Math.round(items.filter((i) => i.stage === 'ideas').reduce((s, i) => s + opportunityScore(i.scores), 0) / inboxCount)
    : 0

  // Quick capture
  const [captureText, setCaptureText] = useState('')
  const [captureCat, setCaptureCat] = useState<string>(CATEGORIES[0])
  const [captured, setCaptured] = useState(false)

  const saveCapture = () => {
    const text = captureText.trim()
    if (!text) return
    const now = nowIso()
    const item: Item = {
      id: uid(),
      title: text.length > 90 ? text.slice(0, 90) + '…' : text,
      problem: '',
      category: captureCat,
      audience: 'Developers',
      format: 'Article',
      estimatedEffort: 3,
      potentialImpact: 5,
      reusable: false,
      stage: 'ideas',
      priority: 'medium',
      notes: text,
      scores: { audienceValue: 5, novelty: 5, personalRelevance: 5, easeOfExecution: 5 },
      coreIdea: '',
      hook: '',
      audienceProblem: '',
      keyInsight: '',
      script: '',
      visualPlan: '',
      productionNotes: '',
      linkedInPost: '',
      instagramCaption: '',
      checklist: [],
      performance: null,
      lessonsLearned: '',
      createdAt: now,
      updatedAt: now,
    }
    addItem(item)
    setCaptureText('')
    setCaptured(true)
    window.setTimeout(() => setCaptured(false), 2600)
  }

  const recentExperiments = [...experiments]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3)

  return (
    <div className="stack">
      {/* Stat strip */}
      <div className="stat-strip">
        <div className="stat">
          <span className="stat__label">Ideas in inbox</span>
          <span className="stat__value">{inboxCount}</span>
          <span className="stat__sub">avg opportunity {avgScore}/40</span>
        </div>
        <div className="stat">
          <span className="stat__label">In pipeline</span>
          <span className="stat__value">{pipelineCount}</span>
          <span className="stat__sub">research → production</span>
        </div>
        <div className="stat">
          <span className="stat__label">Published</span>
          <span className="stat__value">{publishedCount}</span>
          <span className="stat__sub">records with data</span>
        </div>
        <div className="stat">
          <span className="stat__label">Total views</span>
          <span className="stat__value">{formatNumber(totalViews)}</span>
          <span className="stat__sub">across published work</span>
        </div>
      </div>

      <div className="dash-grid">
        {/* Recommendation */}
        <div className="col-8">
          <Card className="reco">
            <div className="reco__eyebrow">
              <IconSparkle size={14} />
              What should I build next?
            </div>

            {reco ? (
              <>
                <div>
                  <h2 className="reco__title">{reco.item.title}</h2>
                  <div className="reco__meta" style={{ marginTop: 10 }}>
                    <CategoryBadge category={reco.item.category} />
                    <Badge tone="neutral">{reco.item.format}</Badge>
                    <Badge tone="accent">{reco.item.audience}</Badge>
                    {reco.item.reusable && <Badge tone="green">Reusable</Badge>}
                  </div>
                </div>

                <div className="reco__reasons">
                  {reco.reasons.map((r, i) => (
                    <div key={i} className="reco__reason">
                      {r}
                    </div>
                  ))}
                </div>

                <div className="reco__stats">
                  <div className="reco-stat">
                    <span className="reco-stat__value">
                      {reco.score}
                      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}> /40</span>
                    </span>
                    <span className="reco-stat__label">Opportunity score</span>
                  </div>
                  <div className="reco-stat">
                    <span className="reco-stat__value">{EFFORT_LABELS[reco.item.estimatedEffort] ?? '—'}</span>
                    <span className="reco-stat__label">Effort {reco.item.estimatedEffort}/5</span>
                  </div>
                  <div className="reco-stat">
                    <span className="reco-stat__value">{reco.item.potentialImpact}/10</span>
                    <span className="reco-stat__label">Potential impact</span>
                  </div>
                  {reco.bonus > 0 && (
                    <div className="reco-stat">
                      <span className="reco-stat__value" style={{ color: 'var(--green)' }}>
                        +{reco.bonus}
                      </span>
                      <span className="reco-stat__label">Reuse bonus</span>
                    </div>
                  )}
                </div>

                <div className="reco__actions">
                  <Button variant="primary" icon={<IconFlask size={15} />} onClick={() => openExperimentEditor(null, reco.item.title)}>
                    Start experiment
                  </Button>
                  <Button variant="outline" icon={<IconBolt size={15} />} onClick={() => navigate(`/items/${reco.item.id}`)}>
                    Create content
                  </Button>
                  <Button variant="ghost" onClick={() => dismiss(reco.item.id)}>
                    Dismiss
                  </Button>
                </div>
              </>
            ) : (
              <p className="empty__hint">No unfinished ideas. Capture a new one to get a recommendation.</p>
            )}
          </Card>
        </div>

        {/* Quick capture */}
        <div className="col-4">
          <Card className="capture">
            <CardHeader
              title="Quick capture"
              meta="Get it out of your head before it evaporates."
              actions={<IconCapture size={16} style={{ color: 'var(--text-faint)' }} />}
            />
            <Textarea
              className="capture__input"
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              placeholder="Capture an idea…"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveCapture()
              }}
            />
            <div className="capture__row">
              <Select value={captureCat} onChange={(e) => setCaptureCat(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Button variant="primary" onClick={saveCapture} disabled={!captureText.trim()}>
                Save
              </Button>
            </div>
            {captured && (
              <span className="capture__saved">
                <IconCheck size={14} /> Saved to your idea inbox
              </span>
            )}
          </Card>
        </div>

        {/* Pipeline summary */}
        <div className="col-5">
          <Card>
            <CardHeader
              title="Content pipeline"
              meta="Where your ideas are right now."
              actions={
                <Link to="/pipeline" className="inline-link">
                  Open board <IconChevronRight size={13} />
                </Link>
              }
            />
            <div className="pipe-summary">
              {STAGES.map((s) => {
                const count = items.filter((i) => i.stage === s).length
                const total = Math.max(items.length, 1)
                return (
                  <div key={s} className="pipe-row">
                    <span className="pipe-row__label">{STAGE_META[s].label}</span>
                    <div className="pipe-row__track">
                      <div
                        className="pipe-row__fill"
                        style={{ width: `${(count / total) * 100}%`, background: s === 'published' ? 'var(--green)' : 'var(--accent)' }}
                      />
                    </div>
                    <span className="pipe-row__count">{count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        {/* Recent experiments */}
        <div className="col-7">
          <Card>
            <CardHeader
              title="Recent experiments"
              meta="Learning records, not vanity metrics."
              actions={
                <Link to="/experiments" className="inline-link">
                  All experiments <IconChevronRight size={13} />
                </Link>
              }
            />
            {recentExperiments.length === 0 ? (
              <p className="empty__hint">No experiments yet. Log your first one.</p>
            ) : (
              <div className="row-list">
                {recentExperiments.map((e) => (
                  <button key={e.id} className="row-item row-item--clickable" onClick={() => openExperimentEditor(e)}>
                    <div className="row-item__main">
                      <div className="row-item__title">{e.name}</div>
                      <div className="row-item__sub">
                        {e.keyLearning || 'No key learning yet'} · {timeAgo(e.updatedAt)}
                      </div>
                    </div>
                    <Badge tone={e.outcome === 'success' ? 'green' : e.outcome === 'failed' ? 'red' : 'amber'}>{e.outcome}</Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
