import { useState } from 'react'
import type { Experiment, Metric } from '../types'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { uid, nowIso } from '../lib/utils'
import { EXPERIMENT_STATUSES, EXPERIMENT_STATUS_META, EXPERIMENT_OUTCOMES, EXPERIMENT_OUTCOME_META } from '../lib/constants'
import { Button, Drawer, Field, Input, Textarea, Select } from './ui'
import { IconPlus, IconTrash } from './icons'

function blankExperiment(prefillName = ''): Experiment {
  const now = nowIso()
  return {
    id: uid(),
    name: prefillName,
    status: 'planned',
    outcome: 'mixed',
    hypothesis: '',
    whatWasBuilt: '',
    tools: '',
    timeSpent: '',
    result: '',
    metrics: [],
    whatWorked: '',
    whatFailed: '',
    keyLearning: '',
    followUpIdea: '',
    worthRepeating: false,
    createdAt: now,
    updatedAt: now,
  }
}

function ExperimentForm({ experiment, prefillName, onClose }: { experiment: Experiment | null; prefillName: string; onClose: () => void }) {
  const addExperiment = useStore((s) => s.addExperiment)
  const updateExperiment = useStore((s) => s.updateExperiment)

  const [draft, setDraft] = useState<Experiment>(() =>
    experiment ? { ...experiment, metrics: [...experiment.metrics] } : blankExperiment(prefillName),
  )
  const [error, setError] = useState('')

  const set = <K extends keyof Experiment>(k: K, v: Experiment[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const setMetric = (i: number, patch: Partial<Metric>) =>
    setDraft((d) => ({ ...d, metrics: d.metrics.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }))

  const addMetric = () => setDraft((d) => ({ ...d, metrics: [...d.metrics, { label: '', value: '' }] }))

  const removeMetric = (i: number) => setDraft((d) => ({ ...d, metrics: d.metrics.filter((_, idx) => idx !== i) }))

  const save = () => {
    if (!draft.name.trim()) {
      setError('Give the experiment a name first.')
      return
    }
    const cleaned = { ...draft, metrics: draft.metrics.filter((m) => m.label.trim() || m.value.trim()) }
    if (experiment) {
      updateExperiment(experiment.id, cleaned)
    } else {
      addExperiment(cleaned)
    }
    onClose()
  }

  return (
    <form
      id="experiment-form"
      className="drawer-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      {error && <div className="form-error">{error}</div>}

      <Field label="Experiment name">
        <Input value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Does posting at 6am beat 6pm?" autoFocus />
      </Field>

      <Field label="Hypothesis" hint="A single, falsifiable statement.">
        <Textarea value={draft.hypothesis} onChange={(e) => set('hypothesis', e.target.value)} placeholder="I believe that … will cause … because …" />
      </Field>

      <div className="form-grid">
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as Experiment['status'])}>
            {EXPERIMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXPERIMENT_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Outcome">
          <Select value={draft.outcome} onChange={(e) => set('outcome', e.target.value as Experiment['outcome'])}>
            {EXPERIMENT_OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {EXPERIMENT_OUTCOME_META[o].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="What was built / tested">
        <Textarea value={draft.whatWasBuilt} onChange={(e) => set('whatWasBuilt', e.target.value)} placeholder="The artifact, harness, or setup." />
      </Field>

      <div className="form-grid">
        <Field label="Tools used">
          <Input value={draft.tools} onChange={(e) => set('tools', e.target.value)} placeholder="Python, GPT-4o, eval set…" />
        </Field>
        <Field label="Time spent">
          <Input value={draft.timeSpent} onChange={(e) => set('timeSpent', e.target.value)} placeholder="e.g. 6 hours" />
        </Field>
      </div>

      <Field label="Result" hint="What actually happened — write it like a lab note, not a brag.">
        <Textarea value={draft.result} onChange={(e) => set('result', e.target.value)} />
      </Field>

      <div className="metrics-block">
        <div className="section-label">Metrics</div>
        {draft.metrics.map((m, i) => (
          <div key={i} className="metrics-block__row">
            <Input value={m.label} onChange={(e) => setMetric(i, { label: e.target.value })} placeholder="Metric" />
            <Input value={m.value} onChange={(e) => setMetric(i, { value: e.target.value })} placeholder="Value" />
            <button type="button" className="icon-btn icon-btn--danger" onClick={() => removeMetric(i)} aria-label="Remove metric">
              <IconTrash size={15} />
            </button>
          </div>
        ))}
        <Button variant="subtle" size="sm" type="button" icon={<IconPlus size={14} />} onClick={addMetric}>
          Add metric
        </Button>
      </div>

      <div className="form-grid">
        <Field label="What worked">
          <Textarea value={draft.whatWorked} onChange={(e) => set('whatWorked', e.target.value)} />
        </Field>
        <Field label="What failed">
          <Textarea value={draft.whatFailed} onChange={(e) => set('whatFailed', e.target.value)} />
        </Field>
      </div>

      <Field label="Key learning">
        <Textarea value={draft.keyLearning} onChange={(e) => set('keyLearning', e.target.value)} />
      </Field>

      <Field label="Follow-up idea" hint="The next experiment this one suggests.">
        <Input value={draft.followUpIdea} onChange={(e) => set('followUpIdea', e.target.value)} />
      </Field>

      <label className="check-row">
        <input type="checkbox" className="checkbox" checked={draft.worthRepeating} onChange={(e) => set('worthRepeating', e.target.checked)} />
        <span>
          Worth repeating
          <span className="check-row__hint"> Promotes this experiment into the Insights page as a repeatable win.</span>
        </span>
      </label>
    </form>
  )
}

export function ExperimentEditor() {
  const { experimentOpen, experimentItem, experimentPrefill, closeExperimentEditor } = useUI()

  return (
    <Drawer
      open={experimentOpen}
      onClose={closeExperimentEditor}
      title={experimentItem ? 'Edit experiment' : 'New experiment'}
      subtitle="Log what you tested, what happened, and what you learned."
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={closeExperimentEditor}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="experiment-form">
            {experimentItem ? 'Save changes' : 'Add experiment'}
          </Button>
        </>
      }
    >
      {experimentOpen && (
        <ExperimentForm key={experimentItem?.id ?? `new:${experimentPrefill}`} experiment={experimentItem} prefillName={experimentPrefill} onClose={closeExperimentEditor} />
      )}
    </Drawer>
  )
}
