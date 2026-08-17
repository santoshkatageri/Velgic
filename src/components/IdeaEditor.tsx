import { useMemo, useState } from 'react'
import type { Item, ScoreSet } from '../types'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { uid, nowIso } from '../lib/utils'
import { opportunityScore, SCORE_DIMENSIONS, strongestDimension } from '../lib/scoring'
import { CATEGORIES, FORMATS, AUDIENCES, PRIORITIES, STAGES, STAGE_META } from '../lib/constants'
import { Button, Drawer, Field, Input, Textarea, Select } from './ui'

function blankScores(): ScoreSet {
  return { audienceValue: 5, novelty: 5, personalRelevance: 5, easeOfExecution: 5 }
}

function blankItem(): Item {
  const now = nowIso()
  return {
    id: uid(),
    title: '',
    problem: '',
    category: CATEGORIES[0],
    audience: AUDIENCES[0],
    format: FORMATS[0],
    estimatedEffort: 3,
    potentialImpact: 5,
    reusable: false,
    stage: 'ideas',
    priority: 'medium',
    notes: '',
    scores: blankScores(),
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
}

function ScorePicker({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="score-picker">
      <div className="score-picker__top">
        <span className="score-picker__label" title={hint}>
          {label}
        </span>
        <span className="score-picker__value">{value}</span>
      </div>
      <div className="score-picker__segments">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={n <= value ? 'score-picker__seg score-picker__seg--on' : 'score-picker__seg'}
            onClick={() => onChange(n)}
            aria-label={`${label} ${n}`}
          />
        ))}
      </div>
    </div>
  )
}

function IdeaForm({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const addItem = useStore((s) => s.addItem)
  const updateItem = useStore((s) => s.updateItem)

  const [draft, setDraft] = useState<Item>(() => (item ? { ...item, scores: { ...item.scores } } : blankItem()))
  const [error, setError] = useState('')

  const score = useMemo(() => opportunityScore(draft.scores), [draft.scores])
  const strong = useMemo(() => strongestDimension(draft.scores), [draft.scores])

  const set = <K extends keyof Item>(k: K, v: Item[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const setScore = (k: keyof ScoreSet, v: number) => setDraft((d) => ({ ...d, scores: { ...d.scores, [k]: v } }))

  const save = () => {
    if (!draft.title.trim()) {
      setError('Give the idea a title first.')
      return
    }
    if (item) {
      updateItem(item.id, draft)
    } else {
      addItem(draft)
    }
    onClose()
  }

  return (
    <form
      id="idea-form"
      className="drawer-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      {error && <div className="form-error">{error}</div>}

      <Field label="Title" hint="One clear sentence. Make it concrete and specific.">
        <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Build a CLI that reviews PRs with a local LLM" autoFocus />
      </Field>

      <Field label="Problem / opportunity">
        <Textarea
          value={draft.problem}
          onChange={(e) => set('problem', e.target.value)}
          placeholder="What pain does this solve, or what gap does it fill for your audience?"
        />
      </Field>

      <div className="form-grid">
        <Field label="Category">
          <Select value={draft.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format">
          <Select value={draft.format} onChange={(e) => set('format', e.target.value)}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Audience">
          <Select value={draft.audience} onChange={(e) => set('audience', e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stage">
          <Select value={draft.stage} onChange={(e) => set('stage', e.target.value as Item['stage'])}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estimated effort">
          <Select value={draft.estimatedEffort} onChange={(e) => set('estimatedEffort', Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} — {n === 1 ? 'quick' : n === 3 ? 'moderate' : n === 5 ? 'deep' : n === 2 ? 'light' : 'heavy'}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Potential impact">
          <Select value={draft.potentialImpact} onChange={(e) => set('potentialImpact', Number(e.target.value))}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}/10
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority">
          <Select value={draft.priority} onChange={(e) => set('priority', e.target.value as Item['priority'])}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="check-row">
        <input type="checkbox" className="checkbox" checked={draft.reusable} onChange={(e) => set('reusable', e.target.checked)} />
        <span>
          Reusable across multiple formats
          <span className="check-row__hint"> One build can feed a video, an article, and a thread — worth a scoring bonus.</span>
        </span>
      </label>

      <Field label="Notes">
        <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Links, rough thoughts, constraints, dependencies…" />
      </Field>

      <div className="score-block">
        <div className="score-block__head">
          <span className="section-label">Idea scoring</span>
          <div className="score-block__total">
            Opportunity score <strong>{score}</strong>/40 · strongest on <strong>{strong.label.toLowerCase()}</strong>
          </div>
        </div>
        <div className="score-block__grid">
          {SCORE_DIMENSIONS.map((d) => (
            <ScorePicker key={d.key} label={d.label} hint={d.hint} value={draft.scores[d.key]} onChange={(v) => setScore(d.key, v)} />
          ))}
        </div>
      </div>
    </form>
  )
}

export function IdeaEditor() {
  const { editorOpen, editorItem, closeEditor } = useUI()

  return (
    <Drawer
      open={editorOpen}
      onClose={closeEditor}
      title={editorItem ? 'Edit idea' : 'New idea'}
      subtitle={editorItem ? 'Refine the angle, scores, and metadata.' : 'Capture the idea, then score how strong it is.'}
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={closeEditor}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="idea-form">
            {editorItem ? 'Save changes' : 'Add idea'}
          </Button>
        </>
      }
    >
      {editorOpen && <IdeaForm key={editorItem?.id ?? 'new'} item={editorItem} onClose={closeEditor} />}
    </Drawer>
  )
}
