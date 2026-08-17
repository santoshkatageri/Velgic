import { useState } from 'react'
import type { AssetRef, AssetType } from '../types'
import { ASSET_ROLES, ASSET_TYPES, ASSET_TYPE_META, PLATFORM_META } from '../lib/constants'
import { assetUsage } from '../lib/content'
import { formatDate, nowIso, uid } from '../lib/utils'
import { useStore } from '../store/useStore'
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, useConfirm } from './ui'
import {
  IconCheckCircle,
  IconDoc,
  IconEdit,
  IconImage,
  IconLink,
  IconMusic,
  IconPlus,
  IconTrash,
  IconVideo,
} from './icons'

function TypeIcon({ type, size = 14 }: { type: AssetType; size?: number }) {
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

function blankAsset(): AssetRef {
  return {
    asset_id: uid(),
    filename: '',
    type: 'video',
    reference: '',
    provider: 'local',
    role: null,
    mimeType: null,
    size: null,
    duration: null,
    createdAt: nowIso(),
    notes: '',
  }
}

function AssetForm({ asset, onClose }: { asset: AssetRef | null; onClose: () => void }) {
  const addAsset = useStore((s) => s.addAsset)
  const updateAsset = useStore((s) => s.updateAsset)
  const [draft, setDraft] = useState<AssetRef>(() => (asset ? { ...asset } : blankAsset()))
  const [error, setError] = useState('')

  const set = (patch: Partial<AssetRef>) => setDraft((d) => ({ ...d, ...patch }))

  const save = () => {
    if (!draft.filename.trim() && !draft.reference.trim()) {
      setError('Give the asset a filename or a reference first.')
      return
    }
    if (asset) {
      updateAsset(asset.asset_id, draft)
    } else {
      addAsset(draft)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={asset ? 'Edit asset' : 'New asset'}
      subtitle="Reference-only metadata — no binary media is ever stored."
      width={560}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {asset ? 'Save changes' : 'Add asset'}
          </Button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <Field label="Filename">
        <Input value={draft.filename} onChange={(e) => set({ filename: e.target.value })} placeholder="reel.mp4" autoFocus />
      </Field>
      <div className="form-grid">
        <Field label="Type">
          <Select value={draft.type} onChange={(e) => set({ type: e.target.value as AssetType })}>
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {ASSET_TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Role" hint="video / thumbnail / media / none">
          <Select value={draft.role ?? ''} onChange={(e) => set({ role: e.target.value || null })}>
            <option value="">None</option>
            {ASSET_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Reference" hint="Path in asset storage — a reference, not an upload.">
        <Input className="input--mono" value={draft.reference} onChange={(e) => set({ reference: e.target.value })} placeholder="instagram/reel.mp4" />
      </Field>
      <div className="form-grid">
        <Field label="Provider" hint="local today; Google Drive / R2 later">
          <Input className="input--mono" value={draft.provider} onChange={(e) => set({ provider: e.target.value })} placeholder="local" />
        </Field>
        <Field label="MIME type" hint="Optional">
          <Input className="input--mono" value={draft.mimeType ?? ''} onChange={(e) => set({ mimeType: e.target.value || null })} placeholder="video/mp4" />
        </Field>
        <Field label="Size (bytes)" hint="Optional">
          <Input className="input--mono" type="number" min={0} value={draft.size ?? ''} onChange={(e) => set({ size: e.target.value === '' ? null : Number(e.target.value) })} placeholder="24800000" />
        </Field>
        <Field label="Duration (sec)" hint="Optional">
          <Input className="input--mono" type="number" min={0} value={draft.duration ?? ''} onChange={(e) => set({ duration: e.target.value === '' ? null : Number(e.target.value) })} placeholder="42" />
        </Field>
      </div>
      <Field label="Notes">
        <Input value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Shooting notes, source, owner…" />
      </Field>
    </Modal>
  )
}

/** Asset library — reusable reference-only assets with usage tracking. */
export function AssetLibrary() {
  const assets = useStore((s) => s.assets)
  const campaigns = useStore((s) => s.campaigns)
  const contents = useStore((s) => s.contents)
  const platformContents = useStore((s) => s.platformContents)
  const deleteAsset = useStore((s) => s.deleteAsset)
  const confirm = useConfirm()

  const [editing, setEditing] = useState<AssetRef | null>(null)
  const [creating, setCreating] = useState(false)
  const [blocked, setBlocked] = useState<Record<string, string[]>>({})

  const usagesOf = (id: string) => {
    const usages = assetUsage(id, platformContents)
    return usages.map((pc) => {
      const campaign = campaigns.find((c) => c.id === pc.campaignId)
      const content = campaign ? contents.find((c) => c.id === campaign.contentId) : null
      return `${PLATFORM_META[pc.platform].label} · ${campaign?.name ?? 'unknown campaign'}${content ? ` — ${content.title.slice(0, 36)}${content.title.length > 36 ? '…' : ''}` : ''}`
    })
  }

  const handleDelete = async (asset: AssetRef) => {
    const usages = usagesOf(asset.asset_id)
    if (usages.length > 0) {
      setBlocked((b) => ({ ...b, [asset.asset_id]: usages }))
      return
    }
    const ok = await confirm(`Delete asset "${asset.filename || asset.asset_id}" from the library?`)
    if (ok) {
      const res = deleteAsset(asset.asset_id)
      if (!res.deleted) {
        setBlocked((b) => ({ ...b, [asset.asset_id]: usagesOf(asset.asset_id) }))
      }
    }
  }

  return (
    <section className="stack stack--tight">
      <div className="list-head">
        <div>
          <h2 className="list-head__title">
            <IconVideo size={15} /> Assets
          </h2>
          <p className="list-head__sub">Reusable reference-only assets — usage is tracked, and referenced assets cannot be deleted.</p>
        </div>
        <div className="list-head__side">
          <span className="mono-dim">{assets.length}</span>
          <Button variant="outline" size="sm" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
            Add asset
          </Button>
        </div>
      </div>

      {assets.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconVideo size={20} />}
            title="No assets yet"
            hint="Add reference-only assets (filename, type, reference path) and attach them to platform versions. Binary media is never stored."
            action={
              <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                Add asset
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="asset-grid">
          {assets.map((a) => {
            const usages = usagesOf(a.asset_id)
            const blockedMsg = blocked[a.asset_id]
            return (
              <Card key={a.asset_id} className="asset-card">
                <div className="asset-card__head">
                  <span className="asset-card__icon">
                    <TypeIcon type={a.type} />
                  </span>
                  <div className="asset-card__titles">
                    <div className="asset-card__name">{a.filename || a.asset_id}</div>
                    <div className="asset-card__id">{a.asset_id}</div>
                  </div>
                  <div className="card__actions">
                    <button className="icon-btn" onClick={() => setEditing(a)} aria-label="Edit asset" title="Edit">
                      <IconEdit size={14} />
                    </button>
                    <button className="icon-btn icon-btn--danger" onClick={() => handleDelete(a)} aria-label="Delete asset" title="Delete">
                      <IconTrash size={14} />
                    </button>
                  </div>
                </div>
                <div className="asset-card__ref" title="Reference path — resolved by the storage provider">
                  {a.reference || '— no reference —'}
                </div>
                <div className="asset-card__meta">
                  <Badge tone="neutral">{ASSET_TYPE_META[a.type].label}</Badge>
                  <Badge tone="neutral">{a.provider}</Badge>
                  {a.role && <Badge tone="accent">{a.role}</Badge>}
                  {typeof a.size === 'number' && <Badge tone="neutral">{(a.size / 1_048_576).toFixed(1)} MB</Badge>}
                  {typeof a.duration === 'number' && <Badge tone="neutral">{a.duration}s</Badge>}
                </div>
                <div className="asset-card__usage">
                  {usages.length === 0 ? (
                    <span className="asset-card__unused">Unused — safe to delete</span>
                  ) : (
                    <div className="usage-list">
                      {usages.map((u, i) => (
                        <span key={i} className="usage-chip" title={u}>
                          <IconCheckCircle size={10} /> {u}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {a.notes && <div className="asset-card__notes">{a.notes}</div>}
                {a.createdAt && <div className="asset-card__date">Added {formatDate(a.createdAt)}</div>}
                {blockedMsg && (
                  <div className="asset-card__blocked">
                    Cannot delete — referenced by {blockedMsg.length} platform version{blockedMsg.length === 1 ? '' : 's'}. Detach it from every platform first.
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {(editing || creating) && <AssetForm asset={editing} onClose={() => { setEditing(null); setCreating(false) }} />}
    </section>
  )
}
