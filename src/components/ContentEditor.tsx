import { useState } from 'react'
import type { ContentItem, ContentOrigin, ContentTypeKey, PublishStatus } from '../types'
import { useStore } from '../store/useStore'
import { useUI, type ContentPrefill } from '../store/uiStore'
import { uid, nowIso } from '../lib/utils'
import { CONTENT_TYPES, CONTENT_TYPE_META, CONTENT_ORIGINS, CONTENT_ORIGIN_META, PUBLISH_STATUSES, PUBLISH_STATUS_META, AUDIENCES } from '../lib/constants'
import { Button, Drawer, Field, Input, Textarea, Select } from './ui'

function blankContent(prefill: ContentPrefill | null): ContentItem {
  const now = nowIso()
  return {
    id: uid(),
    title: prefill?.title ?? '',
    concept: prefill?.concept ?? '',
    origin: prefill?.origin ?? 'direct',
    audience: prefill?.audience ?? AUDIENCES[0],
    contentType: prefill?.contentType ?? 'short_video',
    format: prefill?.format ?? '',
    hook: '',
    draft: '',
    notes: prefill?.notes ?? '',
    status: 'draft',
    linkedIdeaId: prefill?.origin === 'idea' ? (prefill.ideaId ?? null) : null,
    linkedExperimentId: prefill?.origin === 'experiment' ? (prefill.experimentId ?? null) : null,
    createdAt: now,
    updatedAt: now,
  }
}

function ContentForm({ content, prefill, onClose }: { content: ContentItem | null; prefill: ContentPrefill | null; onClose: () => void }) {
  const addContent = useStore((s) => s.addContent)
  const updateContent = useStore((s) => s.updateContent)
  const items = useStore((s) => s.items)
  const experiments = useStore((s) => s.experiments)

  const [draft, setDraft] = useState<ContentItem>(() => (content ? { ...content } : blankContent(prefill)))
  const [error, setError] = useState('')

  const set = <K extends keyof ContentItem>(k: K, v: ContentItem[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const save = () => {
    if (!draft.title.trim()) {
      setError('Give the content a title first.')
      return
    }
    const cleaned: ContentItem = {
      ...draft,
      linkedIdeaId: draft.origin === 'idea' ? draft.linkedIdeaId : null,
      linkedExperimentId: draft.origin === 'experiment' ? draft.linkedExperimentId : null,
    }
    if (content) {
      updateContent(content.id, cleaned)
    } else {
      addContent(cleaned)
    }
    onClose()
  }

  return (
    <form
      id="content-form"
      className="drawer-form"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      {error && <div className="form-error">{error}</div>}

      <Field label="Title" hint="One clear sentence — the working title of this piece.">
        <Input value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Why AI agents get stuck in loops" autoFocus />
      </Field>

      <Field label="Concept" hint="The angle: what this content says and why it lands.">
        <Textarea
          value={draft.concept}
          onChange={(e) => set('concept', e.target.value)}
          placeholder="The one-paragraph thesis of this piece…"
        />
      </Field>

      <div className="form-grid">
        <Field label="Origin" hint="Where this content idea came from.">
          <Select value={draft.origin} onChange={(e) => set('origin', e.target.value as ContentOrigin)}>
            {CONTENT_ORIGINS.map((o) => (
              <option key={o} value={o}>
                {CONTENT_ORIGIN_META[o].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Content type">
          <Select value={draft.contentType} onChange={(e) => set('contentType', e.target.value as ContentTypeKey)}>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_META[t].label}
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
        <Field label="Status">
          <Select value={draft.status} onChange={(e) => set('status', e.target.value as PublishStatus)}>
            {PUBLISH_STATUSES.map((s) => (
              <option key={s} value={s}>
                {PUBLISH_STATUS_META[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format" hint="e.g. Vertical 9:16, under 60s">
          <Input
            value={draft.format}
            onChange={(e) => set('format', e.target.value)}
            placeholder={`e.g. ${CONTENT_TYPE_META[draft.contentType].hint}`}
          />
        </Field>
        <div style={{ alignSelf: 'end' }} className="mono-dim">
          {CONTENT_TYPE_META[draft.contentType].hint}
        </div>
      </div>

      {draft.origin === 'idea' && (
        <Field label="Linked idea" hint="The idea in your inbox this content came from.">
          <Select value={draft.linkedIdeaId ?? ''} onChange={(e) => set('linkedIdeaId', e.target.value || null)}>
            <option value="">None</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.title}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {draft.origin === 'experiment' && (
        <Field label="Linked experiment" hint="The experiment this content came from.">
          <Select value={draft.linkedExperimentId ?? ''} onChange={(e) => set('linkedExperimentId', e.target.value || null)}>
            <option value="">None</option>
            {experiments.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Hook" hint="The opening line that stops the scroll.">
        <Textarea value={draft.hook} onChange={(e) => set('hook', e.target.value)} placeholder="e.g. Your AI agent is not stuck in a loop — its memory is." />
      </Field>

      <Field label="Draft" hint="Rough script, outline, or talking points.">
        <Textarea value={draft.draft} onChange={(e) => set('draft', e.target.value)} placeholder="Open with the failure, not the product…" />
      </Field>

      <Field label="Notes">
        <Textarea value={draft.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Sources, constraints, links, follow-ups…" />
      </Field>
    </form>
  )
}

export function ContentEditor() {
  const { contentEditorOpen, contentEditorItem, contentPrefill, closeContentEditor } = useUI()

  return (
    <Drawer
      open={contentEditorOpen}
      onClose={closeContentEditor}
      title={contentEditorItem ? 'Edit content' : 'New content'}
      subtitle={
        contentEditorItem
          ? 'Refine the concept, hook, and metadata.'
          : 'A content concept is independent — no experiment or idea required.'
      }
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={closeContentEditor}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="content-form">
            {contentEditorItem ? 'Save changes' : 'Add content'}
          </Button>
        </>
      }
    >
      {contentEditorOpen && (
        <ContentForm key={contentEditorItem?.id ?? `new:${contentPrefill?.ideaId ?? contentPrefill?.experimentId ?? 'direct'}`} content={contentEditorItem} prefill={contentPrefill} onClose={closeContentEditor} />
      )}
    </Drawer>
  )
}
