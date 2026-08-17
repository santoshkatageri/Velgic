import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { CAMPAIGN_STATUSES, CAMPAIGN_STATUS_META, PLATFORM_KEYS, PLATFORM_META } from '../lib/constants'
import { campaignReadiness, deriveCampaignStatus, nextScheduled, statusGlyph } from '../lib/content'
import { copyCampaignManifest, exportCampaignManifest } from '../lib/manifest'
import { formatDate, formatSchedule } from '../lib/utils'
import { Badge, Button, CampaignStatusBadge, Card, EmptyState, Field, Input, PublishStatusBadge, Select, useConfirm } from '../components/ui'
import { PlatformSection } from '../components/PlatformSection'
import { PublishPromptModal } from '../components/PublishPromptModal'
import { ImportManifestModal } from '../components/ImportManifestModal'
import {
  IconArrowLeft,
  IconClock,
  IconCopy,
  IconDoc,
  IconDownload,
  IconJson,
  IconMegaphone,
  IconPlatform,
  IconPlus,
  IconSparkle,
  IconTrash,
} from '../components/icons'
import type { CampaignStatus, PlatformKey } from '../types'

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const campaigns = useStore((s) => s.campaigns)
  const contents = useStore((s) => s.contents)
  const platformContents = useStore((s) => s.platformContents)
  const updateCampaign = useStore((s) => s.updateCampaign)
  const deleteCampaign = useStore((s) => s.deleteCampaign)
  const addPlatformContent = useStore((s) => s.addPlatformContent)
  const updatePlatformContent = useStore((s) => s.updatePlatformContent)
  const deletePlatformContent = useStore((s) => s.deletePlatformContent)
  const confirm = useConfirm()

  const [promptOpen, setPromptOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)

  const campaign = campaigns.find((c) => c.id === id)
  const content = campaign ? (contents.find((c) => c.id === campaign.contentId) ?? null) : null
  const pcs = useMemo(
    () =>
      (platformContents.filter((pc) => pc.campaignId === id) ?? [])
        .slice()
        .sort((a, b) => PLATFORM_KEYS.indexOf(a.platform) - PLATFORM_KEYS.indexOf(b.platform)),
    [platformContents, id],
  )

  if (!campaign) {
    return (
      <Card>
        <EmptyState
          icon={<IconMegaphone size={20} />}
          title="Campaign not found"
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

  const readiness = campaignReadiness(pcs)
  const next = nextScheduled(pcs)
  const availablePlatforms = PLATFORM_KEYS.filter((p) => !pcs.some((pc) => pc.platform === p))

  const handleExport = () => exportCampaignManifest(campaign, content, pcs)

  const handleDelete = async () => {
    const ok = await confirm(`Delete campaign "${campaign.name}" and all of its platform versions?`)
    if (ok) {
      deleteCampaign(campaign.id)
      navigate(content ? `/content/${content.id}` : '/content')
    }
  }

  const addPlatform = (platform: PlatformKey) => {
    addPlatformContent(campaign.id, platform, content?.contentType ?? null)
    setAddOpen(false)
  }

  return (
    <div className="stack">
      <div className="detail-head card">
        <div className="detail-head__row">
          <div style={{ minWidth: 0 }}>
            <button
              className="text-btn text-btn--back"
              onClick={() => navigate(content ? `/content/${content.id}` : '/content')}
            >
              <IconArrowLeft size={14} /> {content ? 'Content' : 'Back'}
            </button>
            <h1 className="detail-head__title">
              <IconMegaphone size={20} style={{ verticalAlign: '-3px', marginRight: 8, color: 'var(--accent)' }} />
              {campaign.name}
            </h1>
            {content && (
              <div className="detail-head__badges">
                <Link to={`/content/${content.id}`}>
                  <Badge tone="accent" className="badge--link">
                    <IconDoc size={11} /> {content.title}
                  </Badge>
                </Link>
                <CampaignStatusBadge status={campaign.status} />
                <Badge tone="neutral">
                  {pcs.length} platform version{pcs.length === 1 ? '' : 's'}
                </Badge>
                {readiness !== null && <Badge tone="neutral">readiness {readiness}%</Badge>}
                {next && (
                  <Badge tone="violet">
                    <IconClock size={11} /> next: {formatSchedule(next.datetime, next.pc.schedule.timezone)}
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="detail-head__actions">
            <Button variant="danger" size="sm" icon={<IconTrash size={13} />} onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
        <div className="detail-head__meta">
          <span className="mono-dim">Created {formatDate(campaign.createdAt)}</span>
          <span className="mono-dim">· Updated {formatDate(campaign.updatedAt)}</span>
        </div>
      </div>

      <Card className="campaign-head">
        <div className="campaign-head__row">
          <div className="campaign-head__fields">
            <Field label="Campaign name">
              <Input value={campaign.name} onChange={(e) => updateCampaign(campaign.id, { name: e.target.value })} />
            </Field>
            <Field label="Description">
              <Input
                value={campaign.description}
                onChange={(e) => updateCampaign(campaign.id, { description: e.target.value })}
                placeholder="e.g. Launch week distribution across all channels"
              />
            </Field>
          </div>
          <div className="campaign-head__actions">
            <Field label="Campaign status" className="campaign-head__status">
              <Select width={190} value={campaign.status} onChange={(e) => updateCampaign(campaign.id, { status: e.target.value as CampaignStatus })}>
                {CAMPAIGN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {CAMPAIGN_STATUS_META[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              variant="subtle"
              size="sm"
              title="Derive the campaign status from its platform versions"
              onClick={() => updateCampaign(campaign.id, { status: deriveCampaignStatus(pcs) })}
            >
              Derive status
            </Button>
            <div className="add-platform">
              <Button variant="outline" size="sm" icon={<IconPlus size={13} />} onClick={() => setAddOpen((v) => !v)}>
                Add platform
              </Button>
              {addOpen && (
                <div className="add-platform__menu">
                  {availablePlatforms.length === 0 && <span className="add-platform__empty">All platforms added</span>}
                  {availablePlatforms.map((p) => {
                    const Icon = IconPlatform[p]
                    return (
                      <button key={p} className="add-platform__item" onClick={() => addPlatform(p)}>
                        <span className={`platform-icon platform-icon--${p}`}>
                          <Icon size={13} />
                        </span>
                        {PLATFORM_META[p].label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" icon={<IconJson size={13} />} onClick={() => setImportOpen(true)}>
              Import manifest
            </Button>
            <Button variant="outline" size="sm" icon={<IconDownload size={13} />} onClick={handleExport} disabled={pcs.length === 0}>
              Export manifest
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<IconCopy size={13} />}
              disabled={pcs.length === 0}
              onClick={async () => {
                const ok = await copyCampaignManifest(campaign, content, pcs)
                if (ok) {
                  setCopiedJson(true)
                  window.setTimeout(() => setCopiedJson(false), 1800)
                }
              }}
            >
              {copiedJson ? 'Copied ✓' : 'Copy JSON'}
            </Button>
            <Button variant="primary" size="sm" icon={<IconSparkle size={13} />} onClick={() => setPromptOpen(true)} disabled={pcs.length === 0}>
              Generate AI prompt
            </Button>
          </div>
        </div>
        <p className="campaign-head__note">
          The Velgic Publishing Manifest packages this campaign as validated JSON — caption, assets, schedule, status and published URLs per
          platform. Export it, or generate an AI prompt and import the result.
        </p>
        {pcs.length > 0 && (
          <div className="campaign-status-summary">
            <div className="campaign-status-summary__head">
              <span className="section-label">Distribution status</span>
              {readiness !== null && <span className="mono-dim">{readiness}% ready (secondary)</span>}
            </div>
            <div className="campaign-status-summary__rows">
              {pcs.map((pc) => {
                const Icon = IconPlatform[pc.platform]
                return (
                  <div key={pc.id} className={`campaign-status-row campaign-status-row--${pc.status}`}>
                    <span className={`platform-icon platform-icon--${pc.platform}`}>
                      <Icon size={13} />
                    </span>
                    <span className="campaign-status-row__name">
                      {PLATFORM_META[pc.platform].label} · {pc.format}
                    </span>
                    <span className="campaign-status-row__glyph" title={pc.status}>
                      {statusGlyph(pc.status)}
                    </span>
                    <PublishStatusBadge status={pc.status} />
                    {pc.schedule.enabled && pc.schedule.datetime && (
                      <span className="campaign-status-row__meta">
                        <IconClock size={11} /> {formatSchedule(pc.schedule.datetime, pc.schedule.timezone)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>

      {pcs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconMegaphone size={20} />}
            title="No platforms yet"
            hint="Add the first platform version — Instagram, YouTube, LinkedIn, or X — and fill in its metadata."
            action={
              <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
                Add platform
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="platform-stack">
          {pcs.map((pc) => (
            <PlatformSection
              key={pc.id}
              pc={pc}
              onUpdate={(patch) => updatePlatformContent(pc.id, patch)}
              onDelete={() => deletePlatformContent(pc.id)}
              onExportManifest={handleExport}
            />
          ))}
        </div>
      )}

      <PublishPromptModal open={promptOpen} onClose={() => setPromptOpen(false)} campaign={campaign} content={content} platformContents={pcs} />
      <ImportManifestModal open={importOpen} onClose={() => setImportOpen(false)} onImported={(id) => navigate(`/campaigns/${id}`)} />
    </div>
  )
}
