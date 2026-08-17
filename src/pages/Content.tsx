import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { useUI } from '../store/uiStore'
import {
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_META,
  CONTENT_ORIGINS,
  CONTENT_ORIGIN_META,
  CONTENT_STATUSES,
  CONTENT_STATUS_META,
  CONTENT_TYPE_META,
  PLATFORM_META,
  PUBLISH_STATUS_META,
} from '../lib/constants'
import { campaignReadiness, nextScheduled, publishStatusTone } from '../lib/content'
import { formatSchedule, timeAgo } from '../lib/utils'
import { Button, CampaignStatusBadge, Card, ContentStatusBadge, EmptyState, Input, OriginBadge, Select } from '../components/ui'
import { ImportManifestModal } from '../components/ImportManifestModal'
import {
  IconChevronRight,
  IconClock,
  IconDoc,
  IconJson,
  IconMegaphone,
  IconPlatform,
  IconPlus,
  IconSearch,
} from '../components/icons'
import type { CampaignStatus, ContentOrigin, ContentStatus, PlatformKey, PublishStatus } from '../types'

const ORIGIN_FILTERS: Array<ContentOrigin | 'all'> = ['all', ...CONTENT_ORIGINS]

function PlatformChip({ platform, status, schedule }: { platform: PlatformKey; status: PublishStatus; schedule?: string }) {
  const Icon = IconPlatform[platform]
  return (
    <span
      className={`platform-chip platform-chip--${publishStatusTone(status)}`}
      title={`${PLATFORM_META[platform].label} · ${PUBLISH_STATUS_META[status].label}${schedule ? ` · ${schedule}` : ''}`}
    >
      <Icon size={12} />
      {PUBLISH_STATUS_META[status].label}
      {schedule && <span className="platform-chip__clock">{schedule}</span>}
    </span>
  )
}

function StatusChips<T extends string>({
  statuses,
  value,
  onChange,
  label,
}: {
  statuses: T[]
  value: T | 'all'
  onChange: (v: T | 'all') => void
  label: (s: T) => string
}) {
  return (
    <div className="chip-row">
      {(['all', ...statuses] as const).map((s) => (
        <button key={s} className={value === s ? 'chip chip--active' : 'chip'} onClick={() => onChange(s as T | 'all')}>
          {s === 'all' ? 'All' : label(s as T)}
        </button>
      ))}
    </div>
  )
}

export function Content() {
  const navigate = useNavigate()
  const contents = useStore((s) => s.contents)
  const campaigns = useStore((s) => s.campaigns)
  const platformContents = useStore((s) => s.platformContents)
  const openContentEditor = useUI((s) => s.openContentEditor)

  const [query, setQuery] = useState('')
  const [origin, setOrigin] = useState<ContentOrigin | 'all'>('all')
  const [contentStatus, setContentStatus] = useState<ContentStatus | 'all'>('all')
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatus | 'all'>('all')
  const [importOpen, setImportOpen] = useState(false)

  const pcsByCampaign = useMemo(() => {
    const map: Record<string, typeof platformContents> = {}
    for (const pc of platformContents) {
      ;(map[pc.campaignId] ??= []).push(pc)
    }
    return map
  }, [platformContents])

  const contentById = useMemo(() => new Map(contents.map((c) => [c.id, c])), [contents])

  const filteredContents = useMemo(() => {
    let list = [...contents]
    if (contentStatus !== 'all') list = list.filter((c) => c.status === contentStatus)
    if (origin !== 'all') list = list.filter((c) => c.origin === origin)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.concept.toLowerCase().includes(q) ||
          c.hook.toLowerCase().includes(q) ||
          c.notes.toLowerCase().includes(q),
      )
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [contents, query, contentStatus, origin])

  const filteredCampaigns = useMemo(() => {
    let list = [...campaigns]
    if (campaignStatus !== 'all') list = list.filter((c) => c.status === campaignStatus)
    if (origin !== 'all') list = list.filter((c) => contentById.get(c.contentId)?.origin === origin)
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (contentById.get(c.contentId)?.title.toLowerCase().includes(q) ?? false),
      )
    }
    return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [campaigns, contentById, query, campaignStatus, origin])

  return (
    <div className="stack">
      <div className="filter-bar">
        <div className="filter-bar__search">
          <IconSearch size={15} />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search content & campaigns…" />
        </div>
        <Select value={origin} onChange={(e) => setOrigin(e.target.value as ContentOrigin | 'all')} width={180}>
          <option value="all">All origins</option>
          {CONTENT_ORIGINS.map((o) => (
            <option key={o} value={o}>
              {CONTENT_ORIGIN_META[o].label}
            </option>
          ))}
        </Select>
        <div style={{ flex: 1 }} />
        <Button variant="outline" size="sm" icon={<IconJson size={13} />} onClick={() => setImportOpen(true)}>
          Import manifest
        </Button>
        <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => openContentEditor()}>
          New content
        </Button>
      </div>

      {/* ---- Content items ---- */}
      <section className="stack stack--tight">
        <div className="list-head">
          <div>
            <h2 className="list-head__title">
              <IconDoc size={15} /> Content
            </h2>
            <p className="list-head__sub">Content concepts — independent of ideas and experiments.</p>
          </div>
          <span className="mono-dim">{filteredContents.length}</span>
        </div>

        <StatusChips
          statuses={CONTENT_STATUSES}
          value={contentStatus}
          onChange={setContentStatus}
          label={(s) => CONTENT_STATUS_META[s].label}
        />

        {filteredContents.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconDoc size={20} />}
              title="No content yet"
              hint="Create content directly, from an idea, or from an experiment — then turn it into a multi-platform campaign."
              action={
                <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => openContentEditor()}>
                  New content
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="idea-grid">
            {filteredContents.map((c) => {
              const campaignIds = campaigns.filter((k) => k.contentId === c.id).map((k) => k.id)
              const pcs = campaignIds.flatMap((id) => pcsByCampaign[id] ?? [])
              const next = nextScheduled(pcs)
              return (
                <Card key={c.id} className="idea-card content-card" onClick={() => navigate(`/content/${c.id}`)}>
                  <div className="idea-card__top">
                    <h3 className="idea-card__title">{c.title}</h3>
                    <ContentStatusBadge status={c.status} />
                  </div>
                  {c.concept && <p className="idea-card__problem">{c.concept}</p>}
                  <div className="idea-card__badges">
                    <OriginBadge origin={c.origin} label={CONTENT_ORIGIN_META[c.origin].label} />
                    <span className="badge badge--neutral">{CONTENT_TYPE_META[c.contentType].label}</span>
                    <span className="badge badge--neutral">{c.audience}</span>
                  </div>
                  <div className="idea-card__foot">
                    <div className="idea-card__meta-left">
                      <span className="mono-dim">
                        {campaignIds.length} campaign{campaignIds.length === 1 ? '' : 's'} · {pcs.length} platform version{pcs.length === 1 ? '' : 's'}
                      </span>
                      <span className="idea-card__date">
                        {next ? (
                          <span className="sched-inline">
                            <IconClock size={11} /> {formatSchedule(next.datetime, next.pc.schedule.timezone)}
                          </span>
                        ) : (
                          `Updated ${timeAgo(c.updatedAt)}`
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ---- Campaigns ---- */}
      <section className="stack stack--tight">
        <div className="list-head">
          <div>
            <h2 className="list-head__title">
              <IconMegaphone size={15} /> Campaigns
            </h2>
            <p className="list-head__sub">One content concept, distributed across platforms.</p>
          </div>
          <span className="mono-dim">{filteredCampaigns.length}</span>
        </div>

        <StatusChips
          statuses={CAMPAIGN_STATUSES}
          value={campaignStatus}
          onChange={setCampaignStatus}
          label={(s) => CAMPAIGN_STATUS_META[s].label}
        />

        {filteredCampaigns.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconMegaphone size={20} />}
              title="No campaigns yet"
              hint="Open a content piece and create a campaign to distribute it across platforms."
            />
          </Card>
        ) : (
          <div className="campaign-grid">
            {filteredCampaigns.map((campaign) => {
              const content = contentById.get(campaign.contentId) ?? null
              const pcs = (pcsByCampaign[campaign.id] ?? []).slice().sort((a, b) => a.platform.localeCompare(b.platform))
              const readiness = campaignReadiness(pcs)
              const next = nextScheduled(pcs)
              return (
                <Card key={campaign.id} className="campaign-card" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <div className="campaign-card__top">
                    <div style={{ minWidth: 0 }}>
                      <h3 className="campaign-card__title">{campaign.name}</h3>
                      {content && (
                        <Link
                          to={`/content/${content.id}`}
                          className="campaign-card__content"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {content.title}
                        </Link>
                      )}
                    </div>
                    <div className="campaign-card__top-right">
                      <CampaignStatusBadge status={campaign.status} />
                      {readiness !== null && (
                        <span className="campaign-card__readiness" title="Publishing readiness">
                          {readiness}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="campaign-card__platforms">
                    {pcs.length === 0 ? (
                      <span className="empty__hint">No platforms yet — add one inside the campaign.</span>
                    ) : (
                      pcs.map((pc) => (
                        <PlatformChip
                          key={pc.id}
                          platform={pc.platform}
                          status={pc.status}
                          schedule={pc.schedule.enabled && pc.schedule.datetime ? formatSchedule(pc.schedule.datetime, pc.schedule.timezone) : undefined}
                        />
                      ))
                    )}
                  </div>
                  {readiness !== null && (
                    <div className="campaign-card__bar">
                      <div className="campaign-card__bar-fill" style={{ width: `${readiness}%` }} />
                    </div>
                  )}
                  <div className="campaign-card__foot">
                    <span className="idea-card__date">
                      {next ? (
                        <span className="sched-inline">
                          <IconClock size={11} /> Next: {formatSchedule(next.datetime, next.pc.schedule.timezone)}
                        </span>
                      ) : (
                        `Updated ${timeAgo(campaign.updatedAt)}`
                      )}
                    </span>
                    <span className="inline-link" style={{ pointerEvents: 'none' }}>
                      Open <IconChevronRight size={13} />
                    </span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      <ImportManifestModal open={importOpen} onClose={() => setImportOpen(false)} onImported={(id) => navigate(`/campaigns/${id}`)} />
    </div>
  )
}
