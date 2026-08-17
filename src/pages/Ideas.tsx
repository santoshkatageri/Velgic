import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import { opportunityScore } from '../lib/scoring'
import { CATEGORIES, STAGES, STAGE_META } from '../lib/constants'
import { formatDate } from '../lib/utils'
import { Button, Card, ScoreRing, CategoryBadge, PriorityBadge, EmptyState, Select, Input, useConfirm } from '../components/ui'
import { IconPlus, IconEdit, IconTrash, IconSearch, IconInbox } from '../components/icons'
import type { Item, Stage } from '../types'

type SortKey = 'score' | 'newest' | 'effort'

export function Ideas() {
  const items = useStore((s) => s.items)
  const deleteItem = useStore((s) => s.deleteItem)
  const openEditor = useUI((s) => s.openEditor)
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [query, setQuery] = useState('')
  const [stage, setStage] = useState<Stage | 'all'>('all')
  const [category, setCategory] = useState<string>('all')
  const [sort, setSort] = useState<SortKey>('score')

  const filtered = useMemo(() => {
    let list = [...items]
    if (stage !== 'all') list = list.filter((i) => i.stage === stage)
    if (category !== 'all') list = list.filter((i) => i.category === category)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (i) => i.title.toLowerCase().includes(q) || i.problem.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q),
      )
    }
    if (sort === 'score') list.sort((a, b) => opportunityScore(b.scores) - opportunityScore(a.scores))
    if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    if (sort === 'effort') list.sort((a, b) => a.estimatedEffort - b.estimatedEffort)
    return list
  }, [items, query, stage, category, sort])

  const handleDelete = async (item: Item) => {
    const ok = await confirm(`Delete "${item.title}"? This can't be undone.`)
    if (ok) deleteItem(item.id)
  }

  return (
    <div className="stack">
      <div className="filter-bar">
        <div className="filter-bar__search">
          <IconSearch size={15} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ideas…" />
        </div>

        <div className="chip-row">
          {(['all', ...STAGES] as const).map((s) => (
            <button key={s} className={stage === s ? 'chip chip--active' : 'chip'} onClick={() => setStage(s)}>
              {s === 'all' ? 'All' : STAGE_META[s].label}
            </button>
          ))}
        </div>

        <Select value={category} onChange={(e) => setCategory(e.target.value)} width={170}>
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>

        <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} width={150}>
          <option value="score">Sort: score</option>
          <option value="newest">Sort: newest</option>
          <option value="effort">Sort: effort</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconInbox size={20} />}
            title="No ideas here yet"
            hint="Capture an idea, or adjust your filters."
            action={
              <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => openEditor(null)}>
                New idea
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="idea-grid">
          {filtered.map((item) => {
            const score = opportunityScore(item.scores)
            return (
              <Card key={item.id} className="idea-card" onClick={() => navigate(`/items/${item.id}`)}>
                <div className="idea-card__top">
                  <h3 className="idea-card__title">{item.title}</h3>
                  <div className="idea-card__scores">
                    <ScoreRing value={score} size={40} />
                  </div>
                </div>
                {item.problem && <p className="idea-card__problem">{item.problem}</p>}
                <div className="idea-card__badges">
                  <CategoryBadge category={item.category} />
                  <span className="badge badge--neutral">{item.format}</span>
                  <PriorityBadge priority={item.priority} />
                  {item.reusable && <span className="badge badge--green">reusable</span>}
                </div>
                <div className="idea-card__foot">
                  <div className="idea-card__meta-left">
                    <span className="mono-dim">effort {item.estimatedEffort}/5 · impact {item.potentialImpact}/10</span>
                    <span className="idea-card__date">{formatDate(item.createdAt)}</span>
                  </div>
                  <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" onClick={() => openEditor(item)} aria-label="Edit idea" title="Edit">
                      <IconEdit size={14} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(item)} aria-label="Delete idea" title="Delete">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
