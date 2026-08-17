import { useState } from 'react'
import type { AssetRef, AssetType, PlatformContent, PlatformKey, PublishStatus, ScheduleInfo } from '../types'
import { ASSET_TYPES, ASSET_TYPE_META, PLATFORM_META, PUBLISH_STATUSES, PUBLISH_STATUS_META } from '../lib/constants'
import { blankAssetRef, platformCaptionText, platformPrimaryText, platformReadiness } from '../lib/content'
import { copyText, formatDate, formatSchedule, isoToLocalInput, localInputToIso, nowIso, tomorrowNineIso } from '../lib/utils'
import { Badge, Button, Field, Input, PublishStatusBadge, Select, Textarea, useConfirm } from './ui'
import {
  IconCheckCircle,
  IconCopy,
  IconDoc,
  IconDownload,
  IconExternal,
  IconImage,
  IconLink,
  IconMusic,
  IconPlatform,
  IconPlus,
  IconTrash,
  IconVideo,
} from './icons'

const PLATFORM_ICONS: Record<PlatformKey, typeof IconVideo> = {
  instagram: IconPlatform.instagram,
  youtube: IconPlatform.youtube,
  linkedin: IconPlatform.linkedin,
  x: IconPlatform.x,
}

function AssetTypeIcon({ type, size = 14 }: { type: AssetType; size?: number }) {
  switch (type) {
    case 'video':
      return <IconVideo size={size} />
    case 'image':
      return <IconImage size={size} />
    case 'audio':
      return <IconMusic size={size} />
    case 'link':
      return <IconLink size={size} />
    default:
      return <IconDoc size={size} />
  }
}

/* -------------------------------------------------------------------------- */
/*  Asset reference editor                                                     */
/* -------------------------------------------------------------------------- */

function AssetEditor({
  platform,
  role,
  label,
  hint,
  asset,
  onSave,
  onClear,
  existing,
}: {
  platform: PlatformKey
  role: string
  label: string
  hint?: string
  asset: AssetRef | null
  onSave: (a: AssetRef) => void
  onClear: () => void
  existing: AssetRef[]
}) {
  if (!asset) {
    return (
      <div className="asset-empty">
        <button type="button" className="text-btn" onClick={() => onSave(blankAssetRef(platform, role, existing))}>
          <IconPlus size={13} /> Add {label.toLowerCase()} reference
        </button>
        {hint && <span className="asset-empty__hint">{hint}</span>}
      </div>
    )
  }
  return (
    <div className="asset-box">
      <div className="asset-box__head">
        <span className="asset-box__icon">
          <AssetTypeIcon type={asset.type} />
        </span>
        <span className="asset-box__id" title="Asset reference — media is never embedded in JSON">
          {asset.asset_id}
        </span>
        <button type="button" className="icon-btn icon-btn--danger" onClick={onClear} aria-label={`Remove ${label}`}>
          <IconTrash size={14} />
        </button>
      </div>
      <div className="asset-box__grid">
        <Field label="Filename">
          <Input value={asset.filename} onChange={(e) => onSave({ ...asset, filename: e.target.value })} placeholder="reel.mp4" />
        </Field>
        <Field label="Type">
          <Select value={asset.type} onChange={(e) => onSave({ ...asset, type: e.target.value as AssetType })}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Reference" hint={hint ?? 'Path in asset storage — a reference, not an upload.'} className="asset-box__ref">
          <Input
            className="input--mono"
            value={asset.reference}
            onChange={(e) => onSave({ ...asset, reference: e.target.value })}
            placeholder={`${platform}/reel.mp4`}
          />
        </Field>
        <div className="asset-box__optional">
          <Field label="MIME type" hint="Optional">
            <Input
              className="input--mono"
              value={asset.mimeType ?? ''}
              onChange={(e) => onSave({ ...asset, mimeType: e.target.value || null })}
              placeholder="video/mp4"
            />
          </Field>
          <Field label="Size (bytes)" hint="Optional">
            <Input
              className="input--mono"
              type="number"
              min={0}
              value={asset.size ?? ''}
              onChange={(e) => onSave({ ...asset, size: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="24800000"
            />
          </Field>
          <Field label="Duration (sec)" hint="Optional">
            <Input
              className="input--mono"
              type="number"
              min={0}
              value={asset.duration ?? ''}
              onChange={(e) => onSave({ ...asset, duration: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="42"
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Schedule editor                                                            */
/* -------------------------------------------------------------------------- */

function ScheduleEditor({
  schedule,
  status,
  onUpdate,
}: {
  schedule: ScheduleInfo
  status: PublishStatus
  onUpdate: (s: ScheduleInfo) => void
}) {
  const toggle = () => {
    if (schedule.enabled) {
      onUpdate({ ...schedule, enabled: false })
    } else {
      onUpdate({ ...schedule, enabled: true, datetime: schedule.datetime ?? tomorrowNineIso() })
    }
  }
  return (
    <div className="sched-box">
      <label className="sched-box__toggle">
        <input type="checkbox" className="checkbox" checked={schedule.enabled} onChange={toggle} />
        <span>
          Schedule enabled
          {schedule.enabled && schedule.datetime && (
            <span className="sched-box__preview">{formatSchedule(schedule.datetime, schedule.timezone)}</span>
          )}
        </span>
      </label>
      {schedule.enabled && (
        <div className="form-grid">
          <Field label="Schedule datetime (local)">
            <Input
              type="datetime-local"
              value={isoToLocalInput(schedule.datetime)}
              onChange={(e) => onUpdate({ ...schedule, datetime: localInputToIso(e.target.value) })}
            />
          </Field>
          <Field label="Timezone (IANA)" hint='e.g. "America/New_York"'>
            <Input
              value={schedule.timezone ?? ''}
              onChange={(e) => onUpdate({ ...schedule, timezone: e.target.value || null })}
              placeholder="America/New_York"
            />
          </Field>
        </div>
      )}
      {status === 'scheduled' && !(schedule.enabled && schedule.datetime) && (
        <p className="hint-warn">Status is “Scheduled” but no schedule datetime is set.</p>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Status + lifecycle actions                                                 */
/* -------------------------------------------------------------------------- */

function StatusControls({ pc, onUpdate }: { pc: PlatformContent; onUpdate: (patch: Partial<PlatformContent>) => void }) {
  const mark = (status: PublishStatus) => {
    const patch: Partial<PlatformContent> = { status }
    if (status === 'published' && !pc.publishedAt) patch.publishedAt = nowIso()
    if (status === 'scheduled' && !(pc.schedule.enabled && pc.schedule.datetime)) {
      patch.schedule = { ...pc.schedule, enabled: true, datetime: pc.schedule.datetime ?? tomorrowNineIso() }
    }
    onUpdate(patch)
  }

  return (
    <div className="status-controls">
      <div className="status-controls__row">
        <Select width={150} value={pc.status} onChange={(e) => mark(e.target.value as PublishStatus)}>
          {PUBLISH_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PUBLISH_STATUS_META[s].label}
            </option>
          ))}
        </Select>
        <div className="status-controls__buttons">
          <Button variant="subtle" size="sm" onClick={() => mark('ready')} disabled={pc.status === 'ready'}>
            Mark ready
          </Button>
          <Button
            variant="subtle"
            size="sm"
            onClick={() => mark('scheduled')}
            title="Mark as scheduled — enables the schedule with a default datetime if none is set"
          >
            Mark scheduled
          </Button>
          <Button variant="subtle" size="sm" onClick={() => mark('published')} disabled={pc.status === 'published'}>
            Mark published
          </Button>
        </div>
      </div>
      <div className="status-controls__row status-controls__url">
        <Field label="Published URL" hint={pc.status === 'published' ? 'Required for a published version.' : 'Add once the post is live.'}>
          <Input
            className="input--mono"
            value={pc.publishedUrl ?? ''}
            onChange={(e) => onUpdate({ publishedUrl: e.target.value || null })}
            placeholder="https://…"
          />
        </Field>
        {pc.publishedAt && <span className="mono-dim">Published {formatDate(pc.publishedAt)}</span>}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Platform section                                                           */
/* -------------------------------------------------------------------------- */

export function PlatformSection({
  pc,
  onUpdate,
  onDelete,
  onExportManifest,
}: {
  pc: PlatformContent
  onUpdate: (patch: Partial<PlatformContent>) => void
  onDelete: () => void
  onExportManifest: () => void
}) {
  const meta = PLATFORM_META[pc.platform]
  const PlatformIcon = PLATFORM_ICONS[pc.platform]
  const confirm = useConfirm()
  const readiness = platformReadiness(pc)
  const [copied, setCopied] = useState<'content' | 'caption' | null>(null)

  const currentMeta = (): Record<string, unknown> => {
    switch (pc.platform) {
      case 'instagram':
        return { ...pc.instagram }
      case 'youtube':
        return { ...pc.youtube }
      case 'linkedin':
        return { ...pc.linkedin }
      case 'x':
        return { ...pc.x }
    }
  }
  const setMeta = (patch: Record<string, unknown>) =>
    onUpdate({ [pc.platform]: { ...currentMeta(), ...patch } } as Partial<PlatformContent>)

  const doCopy = async (kind: 'content' | 'caption') => {
    const text = kind === 'content' ? platformPrimaryText(pc) : platformCaptionText(pc)
    if (!text.trim()) return
    const ok = await copyText(text)
    if (ok) {
      setCopied(kind)
      window.setTimeout(() => setCopied(null), 1800)
    }
  }

  const handleDelete = async () => {
    const ok = await confirm(`Remove the ${meta.label} version from this campaign?`)
    if (ok) onDelete()
  }

  const assetByRole = (role: string): AssetRef | null => pc.assets.find((a) => (a.role ?? 'media') === role) ?? null
  const setAsset = (role: string, asset: AssetRef | null) => {
    const assets = [...pc.assets]
    const idx = assets.findIndex((a) => (a.role ?? 'media') === role)
    if (asset) {
      if (idx >= 0) assets[idx] = asset
      else assets.push(asset)
    } else if (idx >= 0) {
      assets.splice(idx, 1)
    }
    onUpdate({ assets })
  }
  const mediaAssets = pc.assets.filter((a) => (a.role ?? 'media') === 'media')

  const openPlatform = () => window.open(pc.publishedUrl || meta.composerUrl, '_blank', 'noopener')

  const captionLabel = pc.platform === 'youtube' ? 'Copy title' : 'Copy caption'

  return (
    <section className="platform-card">
      <div className="platform-card__head">
        <div className="platform-card__title">
          <span className={`platform-icon platform-icon--${pc.platform}`}>
            <PlatformIcon size={16} />
          </span>
          <div>
            <div className="platform-card__name">{meta.label}</div>
            <div className="platform-card__meta">{meta.hint}</div>
          </div>
        </div>
        <div className="platform-card__head-right">
          {readiness.ready ? (
            <Badge tone="green" title="Ready to publish">
              <IconCheckCircle size={11} /> Ready
            </Badge>
          ) : (
            <Badge tone="amber" title={`Publishing readiness ${readiness.pct}%`}>
              {readiness.pct}% ready
            </Badge>
          )}
          <PublishStatusBadge status={pc.status} />
          <button className="icon-btn icon-btn--danger" onClick={handleDelete} aria-label={`Remove ${meta.label} version`} title="Remove platform">
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      <div className="platform-card__actions">
        <Button variant="subtle" size="sm" icon={<IconCopy size={13} />} onClick={() => doCopy('content')} disabled={!platformPrimaryText(pc).trim()}>
          {copied === 'content' ? 'Copied' : 'Copy content'}
        </Button>
        <Button variant="subtle" size="sm" icon={<IconCopy size={13} />} onClick={() => doCopy('caption')} disabled={!platformCaptionText(pc).trim()}>
          {copied === 'caption' ? 'Copied' : captionLabel}
        </Button>
        <Button variant="subtle" size="sm" icon={<IconExternal size={13} />} onClick={openPlatform}>
          Open platform
        </Button>
        <Button variant="subtle" size="sm" icon={<IconDownload size={13} />} onClick={onExportManifest} title="Download the campaign's Velgic publishing manifest">
          Export manifest
        </Button>
      </div>

      <div className="platform-card__body">
        <Field label="Format">
          <Select width="100%" value={pc.format} onChange={(e) => onUpdate({ format: e.target.value })}>
            {meta.formats.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>

        {pc.platform === 'instagram' && pc.instagram && (
          <>
            <AssetEditor
              platform={pc.platform}
              role="media"
              label="Asset"
              hint="e.g. instagram/reel.mp4"
              asset={assetByRole('media')}
              onSave={(a) => setAsset('media', a)}
              onClear={() => setAsset('media', null)}
              existing={pc.assets}
            />
            <Field label="Caption">
              <Textarea rows={6} value={pc.instagram.caption} onChange={(e) => setMeta({ caption: e.target.value })} placeholder="POV: your AI agent is not stuck — its memory is 🤖" />
            </Field>
            <Field label="Hashtags" hint="Comma-separated, e.g. #ai, #agents, #buildinpublic">
              <Input
                value={pc.instagram.hashtags.join(', ')}
                onChange={(e) =>
                  setMeta({
                    hashtags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="#ai, #buildinpublic"
              />
            </Field>
            <Field label="Location" hint="Optional — exported as null in the manifest when unset.">
              <Input value={pc.instagram.location} onChange={(e) => setMeta({ location: e.target.value })} placeholder="San Francisco, CA" />
            </Field>
          </>
        )}

        {pc.platform === 'youtube' && pc.youtube && (
          <>
            <AssetEditor
              platform={pc.platform}
              role="video"
              label="Video asset"
              hint="e.g. youtube/short.mp4"
              asset={assetByRole('video')}
              onSave={(a) => setAsset('video', a)}
              onClear={() => setAsset('video', null)}
              existing={pc.assets}
            />
            <AssetEditor
              platform={pc.platform}
              role="thumbnail"
              label="Thumbnail asset"
              hint="e.g. youtube/thumb.jpg"
              asset={assetByRole('thumbnail')}
              onSave={(a) => setAsset('thumbnail', a)}
              onClear={() => setAsset('thumbnail', null)}
              existing={pc.assets}
            />
            <Field label="Title">
              <Input value={pc.youtube.title} onChange={(e) => setMeta({ title: e.target.value })} placeholder="Why AI agents get stuck in loops" />
            </Field>
            <Field label="Description">
              <Textarea rows={5} value={pc.youtube.description} onChange={(e) => setMeta({ description: e.target.value })} placeholder="Context breaks down before reasoning does…" />
            </Field>
            <Field label="Tags" hint="Comma-separated">
              <Input
                value={pc.youtube.tags.join(', ')}
                onChange={(e) =>
                  setMeta({
                    tags: e.target.value
                      .split(',')
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="ai agents, llm, automation"
              />
            </Field>
          </>
        )}

        {pc.platform === 'linkedin' && pc.linkedin && (
          <>
            <Field label="Post text">
              <Textarea rows={9} value={pc.linkedin.postText} onChange={(e) => setMeta({ postText: e.target.value })} placeholder="Most agent failures are context failures…" />
            </Field>
            <div className="assets-list">
              {mediaAssets.map((a) => (
                <AssetEditor
                  key={a.asset_id}
                  platform={pc.platform}
                  role="media"
                  label="Media"
                  asset={a}
                  onSave={(updated) => onUpdate({ assets: pc.assets.map((x) => (x.asset_id === a.asset_id ? updated : x)) })}
                  onClear={() => onUpdate({ assets: pc.assets.filter((x) => x.asset_id !== a.asset_id) })}
                  existing={pc.assets}
                />
              ))}
              <div className="asset-empty">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onUpdate({ assets: [...pc.assets, blankAssetRef(pc.platform, 'media', pc.assets)] })}
                >
                  <IconPlus size={13} /> Add media reference
                </button>
              </div>
            </div>
          </>
        )}

        {pc.platform === 'x' && pc.x && (
          <>
            <Field label="Post / thread content" hint="Separate posts in a thread with a blank line.">
              <Textarea
                rows={9}
                value={pc.x.content}
                onChange={(e) => setMeta({ content: e.target.value })}
                placeholder={'Your AI agent is not stuck in a loop — its memory is.\n\nThe loop is a symptom: the model lost context.\n\nThree fixes: checkpoints, compaction, exit conditions.'}
              />
            </Field>
            <label className="check-row check-row--compact">
              <input type="checkbox" className="checkbox" checked={pc.x.isThread} onChange={(e) => setMeta({ isThread: e.target.checked })} />
              <span>This is a thread</span>
            </label>
            <div className="assets-list">
              {mediaAssets.map((a) => (
                <AssetEditor
                  key={a.asset_id}
                  platform={pc.platform}
                  role="media"
                  label="Media"
                  asset={a}
                  onSave={(updated) => onUpdate({ assets: pc.assets.map((x) => (x.asset_id === a.asset_id ? updated : x)) })}
                  onClear={() => onUpdate({ assets: pc.assets.filter((x) => x.asset_id !== a.asset_id) })}
                  existing={pc.assets}
                />
              ))}
              <div className="asset-empty">
                <button
                  type="button"
                  className="text-btn"
                  onClick={() => onUpdate({ assets: [...pc.assets, blankAssetRef(pc.platform, 'media', pc.assets)] })}
                >
                  <IconPlus size={13} /> Add media reference
                </button>
              </div>
            </div>
          </>
        )}

        <Field label="Notes" hint="Version-specific notes — exported to the manifest.">
          <Textarea rows={2} value={pc.notes} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="e.g. Publish after the newsletter goes out…" />
        </Field>

        <ScheduleEditor schedule={pc.schedule} status={pc.status} onUpdate={(schedule) => onUpdate({ schedule })} />

        <StatusControls pc={pc} onUpdate={onUpdate} />

        {readiness.checks.length > 0 && (
          <div className="readiness">
            <div className="readiness__head">
              <span className="section-label">Publishing readiness</span>
              <span className="mono-dim">{readiness.pct}%</span>
            </div>
            <div className="readiness__grid">
              {readiness.checks.map((c) => (
                <span key={c.label} className={c.done ? 'readiness__check readiness__check--done' : 'readiness__check'}>
                  {c.done ? <IconCheckCircle size={11} /> : <span className="readiness__dot" />}
                  {c.label}
                  {!c.required && <span className="readiness__optional">opt</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
