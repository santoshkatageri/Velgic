import { useMemo, useState } from 'react'
import type { AssetRef, AssetType, PlatformContent, PlatformKey, PlatformMetrics, PublishStatus, ScheduleInfo } from '../types'
import { ASSET_TYPES, ASSET_TYPE_META, PLATFORM_META, PUBLISH_STATUSES, PUBLISH_STATUS_META } from '../lib/constants'
import { blankAssetRef, platformCaptionText, platformPrimaryText, platformReadiness } from '../lib/content'
import { copyText, formatSchedule, isoToLocalInput, localInputToIso, nowIso, tomorrowNineIso } from '../lib/utils'
import { useStore } from '../store/useStore'
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
/*  Add-asset row: new reference OR reuse from the asset library               */
/* -------------------------------------------------------------------------- */

function AssetAddRow({
  label,
  hint,
  attachedIds,
  onNew,
  onUseExisting,
}: {
  label: string
  hint?: string
  attachedIds: string[]
  onNew: () => void
  onUseExisting: (assetId: string) => void
}) {
  const library = useStore((s) => s.assets)
  const [pickerOpen, setPickerOpen] = useState(false)
  const available = library.filter((a) => !attachedIds.includes(a.asset_id))

  return (
    <div className="asset-empty">
      <div className="asset-empty__actions">
        <button type="button" className="text-btn" onClick={onNew}>
          <IconPlus size={13} /> Add {label.toLowerCase()} reference
        </button>
        <button type="button" className="text-btn" onClick={() => setPickerOpen((v) => !v)} title="Reuse an asset from the library">
          <IconPlus size={13} /> Use existing asset
        </button>
      </div>
      {pickerOpen && (
        <select
          className="asset-picker"
          value=""
          onChange={(e) => {
            if (e.target.value) onUseExisting(e.target.value)
            setPickerOpen(false)
          }}
        >
          <option value="">Choose from the asset library…</option>
          {available.map((a) => (
            <option key={a.asset_id} value={a.asset_id}>
              {a.filename || a.asset_id} ({a.type})
            </option>
          ))}
        </select>
      )}
      {hint && <span className="asset-empty__hint">{hint}</span>}
    </div>
  )
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
  onUseExisting,
  sharedCount,
}: {
  platform: PlatformKey
  role: string
  label: string
  hint?: string
  asset: AssetRef | null
  onSave: (a: AssetRef) => void
  onClear: () => void
  existing: AssetRef[]
  onUseExisting: (assetId: string) => void
  sharedCount: number
}) {
  if (!asset) {
    return (
      <AssetAddRow
        label={label}
        hint={hint}
        attachedIds={existing.map((a) => a.asset_id)}
        onNew={() => onSave(blankAssetRef(platform, role, existing))}
        onUseExisting={onUseExisting}
      />
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
      {sharedCount > 1 && (
        <div className="asset-box__shared">
          Shared asset — referenced by {sharedCount} platform versions. Edits apply everywhere it is used.
        </div>
      )}
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

const METRIC_KEYS: Array<keyof PlatformMetrics> = ['views', 'likes', 'comments', 'shares', 'saves']

function StatusControls({ pc, onUpdate }: { pc: PlatformContent; onUpdate: (patch: Partial<PlatformContent>) => void }) {
  const mark = (status: PublishStatus) => {
    const patch: Partial<PlatformContent> = { status }
    if (status === 'published' && !pc.publishedAt) patch.publishedAt = nowIso()
    if (status === 'scheduled' && !(pc.schedule.enabled && pc.schedule.datetime)) {
      patch.schedule = { ...pc.schedule, enabled: true, datetime: pc.schedule.datetime ?? tomorrowNineIso() }
    }
    onUpdate(patch)
  }

  const setMetric = (key: keyof PlatformMetrics, value: string) => {
    const current: PlatformMetrics = { views: null, likes: null, comments: null, shares: null, saves: null, ...(pc.metrics ?? {}) }
    onUpdate({ metrics: { ...current, [key]: value === '' ? null : Number(value) } })
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
      </div>
      <div className="status-controls__row">
        <Field label="Published timestamp" hint="Set automatically when you mark Published — edit to correct.">
          <div className="status-controls__ts">
            <Input
              type="datetime-local"
              value={isoToLocalInput(pc.publishedAt)}
              onChange={(e) => onUpdate({ publishedAt: localInputToIso(e.target.value) })}
            />
            <button type="button" className="text-btn" onClick={() => onUpdate({ publishedAt: nowIso() })}>
              Set now
            </button>
          </div>
        </Field>
      </div>
      <Field label="Metrics (optional)" hint="Manual numbers, retained per platform for future Insights — nothing is ingested automatically.">
        <div className="metrics-row">
          {METRIC_KEYS.map((k) => (
            <Input
              key={k}
              type="number"
              min={0}
              placeholder={k}
              value={(pc.metrics?.[k] ?? '') as number | ''}
              onChange={(e) => setMetric(k, e.target.value)}
            />
          ))}
        </div>
      </Field>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Platform section                                                           */
/* -------------------------------------------------------------------------- */

type CopyKind = 'content' | 'caption' | 'title' | 'description'

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

  // Asset library (reusable, reference-only).
  const library = useStore((s) => s.assets)
  const allPlatformContents = useStore((s) => s.platformContents)
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const attachAssetToPlatform = useStore((s) => s.attachAssetToPlatform)

  const usageCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of allPlatformContents) {
      for (const a of p.assets) m[a.asset_id] = (m[a.asset_id] ?? 0) + 1
    }
    return m
  }, [allPlatformContents])

  const [copied, setCopied] = useState<CopyKind | null>(null)

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

  const copyTargets: Array<[CopyKind, string]> =
    pc.platform === 'youtube'
      ? [
          ['title', 'Copy title'],
          ['description', 'Copy description'],
          ['content', 'Copy content'],
        ]
      : [
          ['caption', 'Copy caption'],
          ['content', 'Copy content'],
        ]

  const textFor = (kind: CopyKind): string => {
    switch (kind) {
      case 'content':
        return platformPrimaryText(pc)
      case 'caption':
        return platformCaptionText(pc)
      case 'title':
        return pc.youtube?.title ?? ''
      case 'description':
        return pc.youtube?.description ?? ''
    }
  }

  const doCopy = async (kind: CopyKind) => {
    const text = textFor(kind)
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

  /* ---- asset library plumbing ---- */
  const allExisting = [...pc.assets, ...library]

  /** Ensure the asset exists in the library (create or update) — platform copies are synced by the store. */
  const syncLibrary = (asset: AssetRef) => {
    const lib = library.find((a) => a.asset_id === asset.asset_id)
    if (lib) {
      updateAsset(asset.asset_id, { ...asset, role: lib.role })
    } else {
      addAsset({ ...asset, createdAt: asset.createdAt ?? nowIso(), notes: asset.notes ?? '' })
    }
  }

  const assetByRole = (role: string): AssetRef | null => pc.assets.find((a) => (a.role ?? 'media') === role) ?? null

  const setRoleAsset = (role: string, asset: AssetRef | null) => {
    if (!asset) {
      const cur = assetByRole(role)
      if (cur) onUpdate({ assets: pc.assets.filter((a) => (a.role ?? 'media') !== role) })
      return
    }
    syncLibrary(asset)
    const assets = [...pc.assets]
    const idx = assets.findIndex((a) => (a.role ?? 'media') === role)
    if (idx >= 0) assets[idx] = asset
    else assets.push(asset)
    onUpdate({ assets })
  }

  const setAssetById = (asset: AssetRef) => {
    syncLibrary(asset)
    onUpdate({ assets: pc.assets.map((a) => (a.asset_id === asset.asset_id ? asset : a)) })
  }

  const useExisting = (role: string, assetId: string) => attachAssetToPlatform(pc.id, assetId, role)

  const mediaAssets = pc.assets.filter((a) => (a.role ?? 'media') === 'media')

  const openPlatform = () => window.open(pc.publishedUrl || meta.composerUrl, '_blank', 'noopener')

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
          <PublishStatusBadge status={pc.status} />
          {readiness.ready ? (
            <Badge tone="green" title="Ready to publish">
              <IconCheckCircle size={11} /> Ready
            </Badge>
          ) : (
            <Badge tone="amber" title={`Publishing readiness ${readiness.pct}%`}>
              {readiness.pct}% ready
            </Badge>
          )}
          <button className="icon-btn icon-btn--danger" onClick={handleDelete} aria-label={`Remove ${meta.label} version`} title="Remove platform">
            <IconTrash size={14} />
          </button>
        </div>
      </div>

      <div className="platform-card__actions">
        {copyTargets.map(([kind, label]) => (
          <Button key={kind} variant="subtle" size="sm" icon={<IconCopy size={13} />} onClick={() => doCopy(kind)} disabled={!textFor(kind).trim()}>
            {copied === kind ? 'Copied' : label}
          </Button>
        ))}
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
              onSave={(a) => setRoleAsset('media', a)}
              onClear={() => setRoleAsset('media', null)}
              existing={allExisting}
              onUseExisting={(id) => useExisting('media', id)}
              sharedCount={usageCounts[assetByRole('media')?.asset_id ?? ''] ?? 0}
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
              onSave={(a) => setRoleAsset('video', a)}
              onClear={() => setRoleAsset('video', null)}
              existing={allExisting}
              onUseExisting={(id) => useExisting('video', id)}
              sharedCount={usageCounts[assetByRole('video')?.asset_id ?? ''] ?? 0}
            />
            <AssetEditor
              platform={pc.platform}
              role="thumbnail"
              label="Thumbnail asset"
              hint="e.g. youtube/thumb.jpg"
              asset={assetByRole('thumbnail')}
              onSave={(a) => setRoleAsset('thumbnail', a)}
              onClear={() => setRoleAsset('thumbnail', null)}
              existing={allExisting}
              onUseExisting={(id) => useExisting('thumbnail', id)}
              sharedCount={usageCounts[assetByRole('thumbnail')?.asset_id ?? ''] ?? 0}
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
                  onSave={(updated) => setAssetById(updated)}
                  onClear={() => onUpdate({ assets: pc.assets.filter((x) => x.asset_id !== a.asset_id) })}
                  existing={allExisting}
                  onUseExisting={(id) => useExisting('media', id)}
                  sharedCount={usageCounts[a.asset_id] ?? 0}
                />
              ))}
              <AssetAddRow
                label="Media"
                attachedIds={pc.assets.map((a) => a.asset_id)}
                onNew={() => setAssetById(blankAssetRef(pc.platform, 'media', allExisting))}
                onUseExisting={(id) => useExisting('media', id)}
              />
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
                  onSave={(updated) => setAssetById(updated)}
                  onClear={() => onUpdate({ assets: pc.assets.filter((x) => x.asset_id !== a.asset_id) })}
                  existing={allExisting}
                  onUseExisting={(id) => useExisting('media', id)}
                  sharedCount={usageCounts[a.asset_id] ?? 0}
                />
              ))}
              <AssetAddRow
                label="Media"
                attachedIds={pc.assets.map((a) => a.asset_id)}
                onNew={() => setAssetById(blankAssetRef(pc.platform, 'media', allExisting))}
                onUseExisting={(id) => useExisting('media', id)}
              />
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
