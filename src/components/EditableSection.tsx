import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card } from './ui'

/**
 * Read/Edit text section used across detail pages (shared between the
 * existing pipeline Content Detail and the V2 Content detail pages).
 */
export function EditableSection({
  title,
  value,
  placeholder,
  onSave,
  actions,
  rows = 6,
}: {
  title: string
  value: string
  placeholder: string
  onSave: (text: string) => void
  actions?: ReactNode
  rows?: number
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }
  const save = () => {
    onSave(draft)
    setEditing(false)
  }

  return (
    <Card className="section-card">
      <div className="section-card__head">
        <span className="section-card__title">{title}</span>
        <div className="section-card__tools">
          {!editing && actions}
          {!editing ? (
            <button className="text-btn" onClick={startEdit}>
              Edit
            </button>
          ) : (
            <>
              <button className="text-btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button className="text-btn text-btn--primary" onClick={save}>
                Save
              </button>
            </>
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          className="input input--area section-card__textarea"
          style={{ minHeight: rows * 22 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
        />
      ) : value.trim() ? (
        <div className="section-card__body">{value}</div>
      ) : (
        <div className="section-card__body section-card__body--empty">{placeholder}</div>
      )}
    </Card>
  )
}
