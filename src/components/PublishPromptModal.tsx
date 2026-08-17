import { useMemo, useState } from 'react'
import type { Campaign, ContentItem, PlatformContent } from '../types'
import { buildPublishPrompt } from '../lib/publishPrompt'
import { copyText } from '../lib/utils'
import { Button, Modal } from './ui'
import { IconCopy, IconSparkle } from './icons'

export function PublishPromptModal({
  open,
  onClose,
  campaign,
  content,
  platformContents,
}: {
  open: boolean
  onClose: () => void
  campaign: Campaign
  content: ContentItem | null
  platformContents: PlatformContent[]
}) {
  const [copied, setCopied] = useState(false)

  const prompt = useMemo(
    () => buildPublishPrompt({ campaign, content, platformContents }),
    [campaign, content, platformContents],
  )

  const handleCopy = async () => {
    const ok = await copyText(prompt)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Velgic AI prompt"
      subtitle="Copy into ChatGPT, Gemini, Claude, Grok, or any AI tool — then import the manifest it returns. No paid AI API needed."
      width={780}
      footer={
        <>
          <span className="mono-dim" style={{ marginRight: 'auto' }}>
            {prompt.length.toLocaleString()} chars
          </span>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" icon={<IconCopy size={14} />} onClick={handleCopy}>
            {copied ? 'Copied ✓' : 'Copy prompt'}
          </Button>
        </>
      }
    >
      <div className="prompt-box">
        <div className="prompt-box__hint">
          <IconSparkle size={13} />
          The prompt embeds the exact Velgic JSON schema and your current values. Placeholders like
          {' {{BRAND_VOICE}}'} stay literal wherever Velgic has no value yet — fill them before sending.
        </div>
        <textarea className="prompt-box__text" readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} spellCheck={false} />
      </div>
    </Modal>
  )
}
