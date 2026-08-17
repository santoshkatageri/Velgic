import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { ai } from '../lib/ai'
import { opportunityScore, SCORE_DIMENSIONS, REUSABLE_BONUS } from '../lib/scoring'
import { CATEGORIES, FORMATS, AUDIENCES, PRIORITIES, STAGES, STAGE_META, EFFORT_LABELS } from '../lib/constants'
import { ideaFormatToContentType } from '../lib/content'
import { formatDate, uid } from '../lib/utils'
import { Button, Card, ScoreRing, DimensionBars, CategoryBadge, StageBadge, PriorityBadge, Badge, Field, Input, Select, EmptyState, useConfirm } from '../components/ui'
import { EditableSection } from '../components/EditableSection'
import { IconArrowLeft, IconEdit, IconTrash, IconSparkle, IconPlus, IconClose, IconChart, IconInbox, IconBolt } from '../components/icons'
import type { Item, PerformanceRecord } from '../types'

function GenerateButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <Button variant="subtle" size="sm" icon={<IconSparkle size={13} />} onClick={onClick} disabled={busy}>
      {busy ? 'Generating…' : label}
    </Button>
  )
}

export function ContentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const items = useStore((s) => s.items)
  const updateItem = useStore((s) => s.updateItem)
  const deleteItem = useStore((s) => s.deleteItem)
  const moveItem = useStore((s) => s.moveItem)
  const openEditor = useUI((s) => s.openEditor)
  const openContentEditor = useUI((s) => s.openContentEditor)
  const confirm = useConfirm()

  const item = items.find((i) => i.id === id)

  const [busy, setBusy] = useState<Record<string, boolean>>({})

  if (!item) {
    return (
      <Card>
        <EmptyState
          icon={<IconInbox size={20} />}
          title="Item not found"
          hint="It may have been deleted."
          action={
            <Button variant="primary" size="sm" onClick={() => navigate('/pipeline')}>
              Back to pipeline
            </Button>
          }
        />
      </Card>
    )
  }

  const score = opportunityScore(item.scores)

  const runGenerate = async (field: string, fn: (i: Item) => Promise<string>) => {
    setBusy((b) => ({ ...b, [field]: true }))
    try {
      const text = await fn(item)
      updateItem(item.id, { [field]: text } as Partial<Item>)
    } finally {
      setBusy((b) => ({ ...b, [field]: false }))
    }
  }

  const handleDelete = async () => {
    const ok = await confirm(`Delete "${item.title}"? This can't be undone.`)
    if (ok) {
      deleteItem(item.id)
      navigate(-1)
    }
  }

  // Checklist
  const toggleCheck = (checkId: string) =>
    updateItem(item.id, {
      checklist: item.checklist.map((c) => (c.id === checkId ? { ...c, done: !c.done } : c)),
    })

  const addCheck = () => updateItem(item.id, { checklist: [...item.checklist, { id: uid(), label: '', done: false }] })

  const renameCheck = (checkId: string, label: string) =>
    updateItem(item.id, { checklist: item.checklist.map((c) => (c.id === checkId ? { ...c, label } : c)) })

  const removeCheck = (checkId: string) => updateItem(item.id, { checklist: item.checklist.filter((c) => c.id !== checkId) })

  // Performance
  const setPerf = (p: PerformanceRecord | null) => updateItem(item.id, { performance: p })
  const patchPerf = (patch: Partial<PerformanceRecord>) =>
    item.performance && setPerf({ ...item.performance, ...patch })

  const perfFields: Array<{ key: keyof PerformanceRecord; label: string; type?: string }> = [
    { key: 'views', label: 'Views' },
    { key: 'likes', label: 'Likes' },
    { key: 'comments', label: 'Comments' },
    { key: 'shares', label: 'Shares' },
    { key: 'saves', label: 'Saves' },
  ]

  return (
    <div className="stack">
      <div className="detail-head card">
        <div className="detail-head__row">
          <div style={{ minWidth: 0 }}>
            <button className="text-btn text-btn--back" onClick={() => navigate(-1)}>
              <IconArrowLeft size={14} /> Back
            </button>
            <h1 className="detail-head__title">{item.title}</h1>
            <div className="detail-head__badges">
              <CategoryBadge category={item.category} />
              <StageBadge stage={item.stage} />
              <PriorityBadge priority={item.priority} />
              <Badge tone="neutral">{item.format}</Badge>
              <Badge tone="neutral">{item.audience}</Badge>
              {item.reusable && <Badge tone="green">Reusable</Badge>}
            </div>
          </div>
          <div className="detail-head__actions">
            <Button
              variant="subtle"
              size="sm"
              icon={<IconBolt size={13} />}
              title="Turn this idea into a first-class Content piece (no experiment needed)"
              onClick={() =>
                openContentEditor({
                  prefill: {
                    origin: 'idea',
                    ideaId: item.id,
                    title: item.title,
                    concept: item.coreIdea || item.problem || '',
                    audience: item.audience,
                    notes: item.notes,
                    contentType: ideaFormatToContentType(item.format),
                    format: item.format,
                  },
                })
              }
            >
              Create content
            </Button>
            <Button variant="subtle" size="sm" icon={<IconEdit size={13} />} onClick={() => openEditor(item)}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<IconTrash size={13} />} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
        <div className="detail-head__meta">
          <span className="mono-dim">Created {formatDate(item.createdAt)}</span>
          <span className="mono-dim">· Updated {formatDate(item.updatedAt)}</span>
          <span className="mono-dim">· {EFFORT_LABELS[item.estimatedEffort]} (effort {item.estimatedEffort}/5)</span>
          <span className="mono-dim">· potential {item.potentialImpact}/10</span>
        </div>
      </div>

      <div className="detail-grid">
        {/* Main column */}
        <div className="detail-main">
          <EditableSection title="Core idea" value={item.coreIdea} placeholder="The one-sentence thesis of this piece." onSave={(t) => updateItem(item.id, { coreIdea: t })} />
          <EditableSection
            title="Hook"
            value={item.hook}
            placeholder="The opening line that stops the scroll."
            onSave={(t) => updateItem(item.id, { hook: t })}
            actions={<GenerateButton label="Generate 3 hooks" busy={!!busy.hook} onClick={() => runGenerate('hook', ai.generateHooks)} />}
          />
          <EditableSection title="Audience problem" value={item.audienceProblem} placeholder="The pain or gap your audience feels." onSave={(t) => updateItem(item.id, { audienceProblem: t })} />
          <EditableSection title="Key insight" value={item.keyInsight} placeholder="The non-obvious thing worth remembering." onSave={(t) => updateItem(item.id, { keyInsight: t })} />
          <EditableSection
            title="Script"
            value={item.script}
            placeholder="Short-form script with timestamps."
            onSave={(t) => updateItem(item.id, { script: t })}
            actions={<GenerateButton label="Generate short-form script" busy={!!busy.script} onClick={() => runGenerate('script', ai.generateScript)} />}
          />
          <EditableSection
            title="Visual plan"
            value={item.visualPlan}
            placeholder="Shot list / visual direction."
            onSave={(t) => updateItem(item.id, { visualPlan: t })}
            actions={<GenerateButton label="Generate visual plan" busy={!!busy.visualPlan} onClick={() => runGenerate('visualPlan', ai.generateVisualPlan)} />}
          />
          <EditableSection title="Production notes" value={item.productionNotes} placeholder="Recording setup, edits, exports." onSave={(t) => updateItem(item.id, { productionNotes: t })} />
          <EditableSection
            title="LinkedIn post"
            value={item.linkedInPost}
            placeholder="Draft LinkedIn post."
            onSave={(t) => updateItem(item.id, { linkedInPost: t })}
            actions={<GenerateButton label="Generate LinkedIn post" busy={!!busy.linkedin} onClick={() => runGenerate('linkedin', ai.generateLinkedInPost)} />}
          />
          <EditableSection
            title="Instagram caption"
            value={item.instagramCaption}
            placeholder="Draft Instagram caption."
            onSave={(t) => updateItem(item.id, { instagramCaption: t })}
            actions={<GenerateButton label="Generate Instagram caption" busy={!!busy.instagram} onClick={() => runGenerate('instagram', ai.generateInstagramCaption)} />}
          />
          <EditableSection title="Lessons learned" value={item.lessonsLearned} placeholder="What worked, what didn't, what to repeat." onSave={(t) => updateItem(item.id, { lessonsLearned: t })} />
        </div>

        {/* Side column */}
        <div className="detail-side">
          <Card className="section-card">
            <span className="section-card__title">Opportunity score</span>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <ScoreRing value={score} size={64} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono-dim" style={{ fontSize: 13, color: 'var(--text)' }}>
                  {score}/40
                </div>
                <p className="empty__hint" style={{ marginTop: 2 }}>
                  {item.reusable ? `+${REUSABLE_BONUS} reuse bonus for multi-format.` : 'Single-format idea.'}
                </p>
              </div>
            </div>
            <DimensionBars values={SCORE_DIMENSIONS.map((d) => ({ label: d.label, value: item.scores[d.key] }))} />
          </Card>

          <Card className="section-card">
            <span className="section-card__title">Metadata</span>
            <Field label="Stage">
              <Select value={item.stage} onChange={(e) => moveItem(item.id, e.target.value as Item['stage'])}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Category">
                <Select value={item.category} onChange={(e) => updateItem(item.id, { category: e.target.value })}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Format">
                <Select value={item.format} onChange={(e) => updateItem(item.id, { format: e.target.value })}>
                  {FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Audience">
                <Select value={item.audience} onChange={(e) => updateItem(item.id, { audience: e.target.value })}>
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={item.priority} onChange={(e) => updateItem(item.id, { priority: e.target.value as Item['priority'] })}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p[0].toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Card>

          <Card className="section-card">
            <span className="section-card__title">Publishing checklist</span>
            {item.checklist.length === 0 && <p className="empty__hint">No checklist items yet.</p>}
            <div className="checklist">
              {item.checklist.map((c) => (
                <div key={c.id} className={c.done ? 'checklist__item checklist__item--done' : 'checklist__item'}>
                  <input type="checkbox" className="checkbox" checked={c.done} onChange={() => toggleCheck(c.id)} />
                  <input
                    className="checklist__inline-input"
                    value={c.label}
                    onChange={(e) => renameCheck(c.id, e.target.value)}
                    placeholder="Checklist item…"
                  />
                  <button className="icon-btn icon-btn--danger" onClick={() => removeCheck(c.id)} aria-label="Remove item">
                    <IconClose size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button className="text-btn" onClick={addCheck}>
              <IconPlus size={13} /> Add item
            </button>
          </Card>

          <Card className="section-card">
            <div className="section-card__head">
              <span className="section-card__title">Performance</span>
              {item.performance && (
                <button className="text-btn text-btn--danger" onClick={() => setPerf(null)}>
                  Clear
                </button>
              )}
            </div>
            {item.performance ? (
              <div className="perf-grid">
                <Field label="Platform">
                  <Input
                    value={item.performance.platform}
                    onChange={(e) => patchPerf({ platform: e.target.value })}
                    placeholder="YouTube, LinkedIn…"
                  />
                </Field>
                <Field label="Published">
                  <Input
                    type="date"
                    value={(item.performance.publishedAt || '').slice(0, 10)}
                    onChange={(e) => patchPerf({ publishedAt: e.target.value })}
                  />
                </Field>
                <div style={{ gridColumn: '1 / -1' }} />
                {perfFields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <Input
                      type="number"
                      min={0}
                      value={item.performance?.[f.key] ?? 0}
                      onChange={(e) => patchPerf({ [f.key]: Number(e.target.value) } as Partial<PerformanceRecord>)}
                    />
                  </Field>
                ))}
              </div>
            ) : (
              <Button variant="subtle" size="sm" icon={<IconChart size={14} />} onClick={() => setPerf({ publishedAt: new Date().toISOString().slice(0, 10), platform: '', views: 0, likes: 0, comments: 0, shares: 0, saves: 0 })}>
                Add performance data
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
