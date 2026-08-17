import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import {
  AUDIENCES,
  CONTENT_ORIGINS,
  CONTENT_ORIGIN_META,
  CONTENT_STATUSES,
  CONTENT_STATUS_META,
  CONTENT_TYPES,
  CONTENT_TYPE_META,
  PLATFORM_META,
  PUBLISH_STATUS_META,
} from '../lib/constants'
import { campaignReadiness, nextScheduled, publishStatusTone, suggestedPlatforms } from '../lib/content'
import { formatDate, formatSchedule } from '../lib/utils'
import {
  Badge,
  Button,
  CampaignStatusBadge,
  Card,
  ContentStatusBadge,
  EmptyState,
  Field,
  Input,
  Modal,
  OriginBadge,
  Select,
  Textarea,
  useConfirm,
} from '../components/ui'
import { EditableSection } from '../components/EditableSection'
import {
  IconArrowLeft,
  IconBolt,
  IconChevronRight,
  IconClock,
  IconDoc,
  IconEdit,
  IconFlask,
  IconInbox,
  IconMegaphone,
  IconPlatform,
  IconPlus,
  IconTrash,
} from '../components/icons'
import type { ContentOrigin, ContentStatus, ContentTypeKey, PlatformKey } from '../types'

export function ContentView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const contents = useStore((s) => s.contents)
  const campaigns = useStore((s) => s.campaigns)
  const platformContents = useStore((s) => s.platformContents)
  const items = useStore((s) => s.items)
  const experiments = useStore((s) => s.experiments)
  const updateContent = useStore((s) => s.updateContent)
  const deleteContent = useStore((s) => s.deleteContent)
  const openContentEditor = useUI((s) => s.openContentEditor)
  const openExperimentEditor = useUI((s) => s.openExperimentEditor)
  const confirm = useConfirm()

  const [campaignModalOpen, setCampaignModalOpen] = useState(false)

  const content = contents.find((c) => c.id === id)

  const contentCampaigns = useMemo(
    () =>
      campaigns
        .filter((c) => c.contentId === id)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [campaigns, id],
  )

  const pcsByCampaign = useMemo(() => {
    const map: Record<string, typeof platformContents> = {}
    for (const pc of platformContents) {
      ;(map[pc.campaignId] ??= []).push(pc)
    }
    return map
  }, [platformContents])

  if (!content) {
    return (
      <Card>
        <EmptyState
          icon={<IconDoc size={20} />}
          title="Content not found"
          hint="It may have been deleted."
          action={
            <Button variant="primary" size="sm" onClick={() => navigate('/content')}>
              Back to content
            </Button>
          }
        />
      </Card>
    )
  }

  const linkedIdea = content.linkedIdeaId ? (items.find((i) => i.id === content.linkedIdeaId) ?? null) : null
  const linkedExperiment = content.linkedExperimentId
    ? (experiments.find((e) => e.id === content.linkedExperimentId) ?? null)
    : null

  const handleDelete = async () => {
    const ok = await confirm(
      `Delete "${content.title}"? Its campaigns and platform versions will also be removed. This can't be undone.`,
    )
    if (ok) {
      deleteContent(content.id)
      navigate('/content')
    }
  }

  return (
    <div className="stack">
      <div className="detail-head card">
        <div className="detail-head__row">
          <div style={{ minWidth: 0 }}>
            <button className="text-btn text-btn--back" onClick={() => navigate('/content')}>
              <IconArrowLeft size={14} /> Content
            </button>
            <h1 className="detail-head__title">{content.title}</h1>
            <div className="detail-head__badges">
              <OriginBadge origin={content.origin} label={CONTENT_ORIGIN_META[content.origin].label} />
              <Badge tone="neutral">{CONTENT_TYPE_META[content.contentType].label}</Badge>
              <Badge tone="neutral">{content.audience}</Badge>
              {content.format && <Badge tone="neutral">{content.format}</Badge>}
              <ContentStatusBadge status={content.status} />
              {linkedIdea && (
                <Link to={`/items/${linkedIdea.id}`}>
                  <Badge tone="accent" className="badge--link">
                    <IconInbox size={11} /> idea: {linkedIdea.title.slice(0, 40)}
                    {linkedIdea.title.length > 40 ? '…' : ''}
                  </Badge>
                </Link>
              )}
              {linkedExperiment && (
                <button className="badge badge--violet badge--button" onClick={() => openExperimentEditor(linkedExperiment)}>
                  <IconFlask size={11} /> experiment: {linkedExperiment.name.slice(0, 40)}
                  {linkedExperiment.name.length > 40 ? '…' : ''}
                </button>
              )}
            </div>
          </div>
          <div className="detail-head__actions">
            <Button variant="subtle" size="sm" icon={<IconEdit size={13} />} onClick={() => openContentEditor({ content })}>
              Edit
            </Button>
            <Button variant="danger" size="sm" icon={<IconTrash size={13} />} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
        <div className="detail-head__meta">
          <span className="mono-dim">Created {formatDate(content.createdAt)}</span>
          <span className="mono-dim">· Updated {formatDate(content.updatedAt)}</span>
          <span className="mono-dim">· {contentCampaigns.length} campaign{contentCampaigns.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          <EditableSection title="Concept" value={content.concept} placeholder="The angle: what this content says and why it lands." onSave={(t) => updateContent(content.id, { concept: t })} />
          <EditableSection title="Hook" value={content.hook} placeholder="The opening line that stops the scroll." onSave={(t) => updateContent(content.id, { hook: t })} />
          <EditableSection title="Draft" value={content.draft} placeholder="Rough script, outline, or talking points." onSave={(t) => updateContent(content.id, { draft: t })} rows={8} />
          <EditableSection title="Notes" value={content.notes} placeholder="Sources, constraints, links, follow-ups…" onSave={(t) => updateContent(content.id, { notes: t })} />
        </div>

        <div className="detail-side">
          <Card className="section-card">
            <span className="section-card__title">Details</span>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Origin">
                <Select value={content.origin} onChange={(e) => updateContent(content.id, { origin: e.target.value as ContentOrigin })}>
                  {CONTENT_ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {CONTENT_ORIGIN_META[o].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Content type">
                <Select value={content.contentType} onChange={(e) => updateContent(content.id, { contentType: e.target.value as ContentTypeKey })}>
                  {CONTENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {CONTENT_TYPE_META[t].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Audience">
                <Select value={content.audience} onChange={(e) => updateContent(content.id, { audience: e.target.value })}>
                  {AUDIENCES.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" hint="Independent of the production Pipeline stages.">
                <Select value={content.status} onChange={(e) => updateContent(content.id, { status: e.target.value as ContentStatus })}>
                  {CONTENT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {CONTENT_STATUS_META[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Format">
              <Input value={content.format} onChange={(e) => updateContent(content.id, { format: e.target.value })} placeholder="e.g. Vertical 9:16, under 60s" />
            </Field>
            {content.origin === 'idea' && (
              <Field label="Linked idea">
                <Select value={content.linkedIdeaId ?? ''} onChange={(e) => updateContent(content.id, { linkedIdeaId: e.target.value || null })}>
                  <option value="">None</option>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.title}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {content.origin === 'experiment' && (
              <Field label="Linked experiment">
                <Select value={content.linkedExperimentId ?? ''} onChange={(e) => updateContent(content.id, { linkedExperimentId: e.target.value || null })}>
                  <option value="">None</option>
                  {experiments.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </Card>

          <Card className="section-card">
            <div className="section-card__head">
              <span className="section-card__title">Campaigns</span>
              <Button variant="subtle" size="sm" icon={<IconPlus size={13} />} onClick={() => setCampaignModalOpen(true)}>
                New campaign
              </Button>
            </div>
            {contentCampaigns.length === 0 ? (
              <p className="empty__hint">
                Turn this concept into a multi-platform campaign — Instagram, YouTube, LinkedIn, X — each version independently editable, then export the Velgic publishing manifest.
              </p>
            ) : (
              <div className="campaign-list">
                {contentCampaigns.map((campaign) => {
                  const pcs = pcsByCampaign[campaign.id] ?? []
                  const readiness = campaignReadiness(pcs)
                  const next = nextScheduled(pcs)
                  return (
                    <Link key={campaign.id} to={`/campaigns/${campaign.id}`} className="campaign-list__item">
                      <div className="campaign-list__main">
                        <div className="campaign-list__name">{campaign.name}</div>
                        <div className="campaign-list__platforms">
                          {pcs.map((pc) => {
                            const Icon = IconPlatform[pc.platform]
                            return (
                              <span
                                key={pc.id}
                                className={`platform-dot platform-dot--${publishStatusTone(pc.status)}`}
                                title={`${pc.platform} · ${pc.format} · ${PUBLISH_STATUS_META[pc.status].label}`}
                              >
                                <Icon size={11} />
                              </span>
                            )
                          })}
                          {pcs.length === 0 && <span className="empty__hint">No platforms yet</span>}
                        </div>
                      </div>
                      <div className="campaign-list__side">
                        <CampaignStatusBadge status={campaign.status} />
                        {next && (
                          <span className="sched-inline">
                            <IconClock size={11} /> {formatSchedule(next.datetime, next.pc.schedule.timezone)}
                          </span>
                        )}
                        {readiness !== null && <span className="mono-dim">{readiness}%</span>}
                        <IconChevronRight size={13} style={{ color: 'var(--text-faint)' }} />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {campaignModalOpen && (
        <CreateCampaignModal content={content} onClose={() => setCampaignModalOpen(false)} onCreated={(id) => navigate(`/campaigns/${id}`)} />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Create campaign modal                                                      */
/* -------------------------------------------------------------------------- */

function CreateCampaignModal({
  content,
  onClose,
  onCreated,
}: {
  content: { id: string; title: string; contentType: ContentTypeKey }
  onClose: () => void
  onCreated: (campaignId: string) => void
}) {
  const createCampaign = useStore((s) => s.createCampaign)
  const suggested = suggestedPlatforms(content.contentType)

  const [name, setName] = useState(content.title)
  const [description, setDescription] = useState('')
  const [platforms, setPlatforms] = useState<PlatformKey[]>(suggested.length ? suggested : ['instagram'])
  const [error, setError] = useState('')

  const toggle = (p: PlatformKey) =>
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))

  const create = () => {
    if (!name.trim()) {
      setError('Give the campaign a name first.')
      return
    }
    if (platforms.length === 0) {
      setError('Pick at least one platform.')
      return
    }
    const id = createCampaign({
      name: name.trim(),
      description: description.trim(),
      contentId: content.id,
      platforms,
      contentType: content.contentType,
    })
    onCreated(id)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New campaign"
      subtitle="One content concept, distributed across platforms. Each platform version is independently editable."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<IconMegaphone size={14} />} onClick={create}>
            Create campaign
          </Button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <Field label="Campaign name">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
      <Field label="Description">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Launch week distribution across all channels" />
      </Field>
      <Field label="Platforms" hint="Suggested from the content type — you can add more inside the campaign.">
        <div className="platform-picker">
          {(Object.keys(PLATFORM_META) as PlatformKey[]).map((p) => {
            const Icon = IconPlatform[p]
            const checked = platforms.includes(p)
            return (
              <label key={p} className={checked ? 'platform-picker__item platform-picker__item--on' : 'platform-picker__item'}>
                <input type="checkbox" className="checkbox" checked={checked} onChange={() => toggle(p)} />
                <span className={`platform-icon platform-icon--${p}`}>
                  <Icon size={14} />
                </span>
                {PLATFORM_META[p].label}
              </label>
            )
          })}
        </div>
      </Field>
      <div className="import-preview__note">
        <IconBolt size={12} style={{ verticalAlign: '-2px' }} /> No experiment needed — a simple Reel, post, or thread goes straight from concept to campaign.
      </div>
    </Modal>
  )
}
