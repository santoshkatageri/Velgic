import { useMemo, useState } from 'react'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { EXPERIMENT_STATUSES, EXPERIMENT_STATUS_META, EXPERIMENT_OUTCOME_META } from '../lib/constants'
import { formatDate } from '../lib/utils'
import { Button, Card, Badge, EmptyState, useConfirm } from '../components/ui'
import { IconPlus, IconFlask, IconEdit, IconTrash, IconCheck, IconBolt } from '../components/icons'
import type { Experiment, ExperimentStatus } from '../types'

function OutcomeBadge({ outcome }: { outcome: Experiment['outcome'] }) {
  const tone = outcome === 'success' ? 'green' : outcome === 'failed' ? 'red' : 'amber'
  return <Badge tone={tone}>{EXPERIMENT_OUTCOME_META[outcome].label}</Badge>
}

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const tone = status === 'done' ? 'neutral' : status === 'running' ? 'accent' : 'violet'
  return <Badge tone={tone}>{EXPERIMENT_STATUS_META[status].label}</Badge>
}

export function Experiments() {
  const experiments = useStore((s) => s.experiments)
  const deleteExperiment = useStore((s) => s.deleteExperiment)
  const openExperimentEditor = useUI((s) => s.openExperimentEditor)
  const openContentEditor = useUI((s) => s.openContentEditor)
  const confirm = useConfirm()

  const createContentFromExperiment = (e: Experiment) =>
    openContentEditor({
      prefill: {
        origin: 'experiment',
        experimentId: e.id,
        title: e.name,
        concept: e.keyLearning || e.hypothesis || '',
        notes: e.followUpIdea || '',
        contentType: 'short_video',
      },
    })

  const [status, setStatus] = useState<ExperimentStatus | 'all'>('all')

  const filtered = useMemo(() => {
    const list = status === 'all' ? experiments : experiments.filter((e) => e.status === status)
    return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [experiments, status])

  const handleDelete = async (e: Experiment) => {
    const ok = await confirm(`Delete experiment "${e.name}"?`)
    if (ok) deleteExperiment(e.id)
  }

  return (
    <div className="stack">
      <div className="filter-bar">
        <div className="chip-row">
          {(['all', ...EXPERIMENT_STATUSES] as const).map((s) => (
            <button key={s} className={status === s ? 'chip chip--active' : 'chip'} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : EXPERIMENT_STATUS_META[s].label}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => openExperimentEditor(null)}>
          New experiment
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconFlask size={20} />}
            title="No experiments yet"
            hint="Log what you test so you can stop guessing and start learning."
            action={
              <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => openExperimentEditor(null)}>
                New experiment
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="experiment-grid">
          {filtered.map((e) => (
            <Card key={e.id} className="experiment-card" onClick={() => openExperimentEditor(e)}>
              <div className="experiment-card__head">
                <div style={{ minWidth: 0 }}>
                  <h3 className="experiment-card__title">{e.name}</h3>
                  <div className="badges-inline" style={{ marginTop: 7, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <StatusBadge status={e.status} />
                    <OutcomeBadge outcome={e.outcome} />
                    {e.worthRepeating && (
                      <Badge tone="green">
                        <IconCheck size={11} /> worth repeating
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="card__actions" onClick={(ev) => ev.stopPropagation()}>
                  <button className="icon-btn" onClick={() => createContentFromExperiment(e)} aria-label="Create content" title="Create content from this experiment">
                    <IconBolt size={15} />
                  </button>
                  <button className="icon-btn" onClick={() => openExperimentEditor(e)} aria-label="Edit">
                    <IconEdit size={15} />
                  </button>
                  <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(e)} aria-label="Delete">
                    <IconTrash size={15} />
                  </button>
                </div>
              </div>

              {e.hypothesis && <p className="experiment-card__hypothesis">“{e.hypothesis}”</p>}

              <div className="kv-list">
                <div className="kv">
                  <span className="kv__label">What was built</span>
                  <span className="kv__value">{e.whatWasBuilt || '—'}</span>
                </div>
                <div className="kv">
                  <span className="kv__label">Tools</span>
                  <span className="kv__value">{e.tools || '—'}</span>
                </div>
                <div className="kv">
                  <span className="kv__label">Time spent</span>
                  <span className="kv__value">{e.timeSpent || '—'}</span>
                </div>
                {e.keyLearning && (
                  <div className="kv">
                    <span className="kv__label">Key learning</span>
                    <span className="kv__value">{e.keyLearning}</span>
                  </div>
                )}
                {e.followUpIdea && (
                  <div className="kv">
                    <span className="kv__label">Follow-up</span>
                    <span className="kv__value">{e.followUpIdea}</span>
                  </div>
                )}
              </div>

              {e.metrics.length > 0 && (
                <div className="metric-chips">
                  {e.metrics.map((m, i) => (
                    <span key={i} className="metric-chip">
                      {m.label && <>{m.label}: </>}
                      <strong>{m.value}</strong>
                    </span>
                  ))}
                </div>
              )}

              <div className="experiment-card__foot">
                <span className="idea-card__date">Updated {formatDate(e.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
