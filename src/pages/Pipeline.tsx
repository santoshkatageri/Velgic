import { useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { STAGES, STAGE_META } from '../lib/constants'
import { opportunityScore } from '../lib/scoring'
import { formatDate } from '../lib/utils'
import { CategoryBadge, PriorityBadge } from '../components/ui'
import { IconPlus } from '../components/icons'
import type { Item, Stage } from '../types'

export function Pipeline() {
  const items = useStore((s) => s.items)
  const moveItem = useStore((s) => s.moveItem)
  const openEditor = useUI((s) => s.openEditor)
  const navigate = useNavigate()

  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<Stage | null>(null)
  const didDrag = useRef(false)

  const byStage = useMemo(() => {
    const map: Record<Stage, Item[]> = { ideas: [], research: [], script: [], production: [], published: [] }
    for (const item of items) map[item.stage].push(item)
    for (const s of STAGES) {
      map[s].sort((a, b) => opportunityScore(b.scores) - opportunityScore(a.scores))
    }
    return map
  }, [items])

  const onDrop = (stage: Stage, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain') || dragId
    if (id) moveItem(id, stage)
    didDrag.current = true
    setDragId(null)
    setOverCol(null)
    window.setTimeout(() => (didDrag.current = false), 120)
  }

  return (
    <div className="kanban">
      {STAGES.map((stage) => {
        const cards = byStage[stage]
        return (
          <div
            key={stage}
            className={overCol === stage ? 'kanban-col kanban-col--over' : 'kanban-col'}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (overCol !== stage) setOverCol(stage)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol((c) => (c === stage ? null : c))
            }}
            onDrop={(e) => onDrop(stage, e)}
          >
            <div className="kanban-col__head">
              <span className="kanban-col__title">
                {STAGE_META[stage].label}
                <span className="kanban-col__count">{cards.length}</span>
              </span>
              {stage === 'ideas' && (
                <button className="icon-btn" onClick={() => openEditor(null)} aria-label="Add idea" title="Add idea">
                  <IconPlus size={15} />
                </button>
              )}
            </div>
            <div className="kanban-col__body">
              {cards.map((item) => (
                <div
                  key={item.id}
                  className={dragId === item.id ? 'kanban-card kanban-card--dragging' : 'kanban-card'}
                  draggable
                  onDragStart={(e) => {
                    setDragId(item.id)
                    e.dataTransfer.setData('text/plain', item.id)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverCol(null)
                  }}
                  onClick={() => {
                    if (didDrag.current) return
                    navigate(`/items/${item.id}`)
                  }}
                >
                  <div className="kanban-card__title">{item.title}</div>
                  <div className="kanban-card__badges">
                    <CategoryBadge category={item.category} />
                    <PriorityBadge priority={item.priority} />
                  </div>
                  <div className="kanban-card__foot">
                    <span>{item.format}</span>
                    <span>
                      <span className="kanban-card__score">{opportunityScore(item.scores)}</span> · {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              ))}
              {cards.length === 0 && <div className="kanban-col__empty">Drop ideas here</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
