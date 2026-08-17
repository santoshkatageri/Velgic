import { useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { parseManifestText, type ManifestIssue, type VelgicManifest } from '../lib/manifest'
import { Button, Modal } from './ui'
import { IconCheck, IconJson, IconUpload } from './icons'

export function ImportManifestModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: (campaignId: string) => void
}) {
  const importCampaign = useStore((s) => s.importCampaign)
  const fileRef = useRef<HTMLInputElement>(null)

  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [issues, setIssues] = useState<ManifestIssue[] | null>(null)
  const [manifest, setManifest] = useState<VelgicManifest | null>(null)

  const reset = () => {
    setText('')
    setFileName('')
    setIssues(null)
    setManifest(null)
  }

  const validate = () => {
    const result = parseManifestText(text)
    setIssues(result.issues.length ? result.issues : null)
    setManifest(result.manifest)
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    file.text().then((t) => {
      setText(t)
      setIssues(null)
      setManifest(null)
    })
  }

  const doImport = () => {
    if (!manifest) return
    const { issues: importIssues, campaignId } = importCampaign(manifest)
    if (importIssues.length > 0) {
      setIssues(importIssues)
      setManifest(null)
      return
    }
    reset()
    onClose()
    if (campaignId) onImported(campaignId)
  }

  const assetCount = manifest?.platforms.reduce((sum, p) => sum + p.assets.length, 0) ?? 0
  const scheduledCount =
    manifest?.platforms.filter((p) => p.schedule.enabled || p.status === 'scheduled').length ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import publishing manifest"
      subtitle="Paste Velgic JSON or upload a .json file. Validation runs first — nothing is imported unless the whole manifest is valid."
      width={720}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={validate} disabled={!text.trim()}>
            Validate
          </Button>
          <Button variant="primary" icon={<IconCheck size={14} />} onClick={doImport} disabled={!manifest}>
            Import
          </Button>
        </>
      }
    >
      <div className="import-area">
        <textarea
          className="import-area__text input--mono"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setIssues(null)
            setManifest(null)
          }}
          placeholder='{"schema_version": "1.0", …}'
          spellCheck={false}
        />
        <div className="import-area__upload">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
          <Button variant="subtle" size="sm" icon={<IconUpload size={13} />} onClick={() => fileRef.current?.click()}>
            Upload .json
          </Button>
          {fileName && <span className="mono-dim">{fileName}</span>}
        </div>
      </div>

      {issues && issues.length > 0 && (
        <div className="import-issues">
          <div className="import-issues__title">
            <span className="section-label">Validation failed — nothing was imported</span>
            <span className="mono-dim">
              {issues.length} issue{issues.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="import-issues__list">
            {issues.map((issue, i) => (
              <li key={i} className="import-issue">
                <span className="import-issue__code">{issue.code}</span>
                <span className="import-issue__path">{issue.path}</span>
                <span className="import-issue__message">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {manifest && !issues && (
        <div className="import-preview">
          <div className="import-preview__title">
            <IconJson size={14} />
            Valid manifest — ready to import
          </div>
          <div className="import-preview__grid">
            <div className="import-preview__cell">
              <span className="import-preview__label">Campaign</span>
              <span className="import-preview__value">{manifest.campaign.name}</span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Content</span>
              <span className="import-preview__value">{manifest.campaign.content?.title ?? '—'}</span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Campaign status</span>
              <span className="import-preview__value">{manifest.campaign.status ?? 'derived from platforms'}</span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Platforms</span>
              <span className="import-preview__value">
                {manifest.platforms.map((p) => `${p.platform} (${p.format}, ${p.status})`).join(' · ') || '—'}
              </span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Assets</span>
              <span className="import-preview__value">{assetCount} referenced</span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Schedules</span>
              <span className="import-preview__value">{scheduledCount} scheduled</span>
            </div>
            <div className="import-preview__cell">
              <span className="import-preview__label">Schema</span>
              <span className="import-preview__value">v{manifest.schema_version}</span>
            </div>
          </div>
          <p className="import-preview__note">
            Importing creates a new Content item, Campaign, and Platform versions from the manifest — links to existing ideas/experiments are preserved when their IDs exist.
          </p>
        </div>
      )}
    </Modal>
  )
}
