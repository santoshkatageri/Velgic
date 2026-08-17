import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { cx, clamp } from '../lib/utils'
import { CAMPAIGN_STATUS_META, CATEGORY_COLORS, CONTENT_STATUS_META, PUBLISH_STATUS_META } from '../lib/constants'
import { campaignStatusTone, contentStatusTone, publishStatusTone } from '../lib/content'
import type { Priority, Stage, PublishStatus, ContentOrigin, ContentStatus, CampaignStatus } from '../types'
import { useUI } from '../store/uiStore'
import { IconClose } from './icons'

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */
type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'danger' | 'subtle'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: ReactNode
}

export function Button({ variant = 'outline', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button className={cx('btn', `btn--${variant}`, `btn--${size}`, className)} {...rest}>
      {icon && <span className="btn__icon">{icon}</span>}
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */
export function Badge({
  children,
  tone = 'neutral',
  dot,
  className,
  title,
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'cyan' | 'pink' | 'emerald' | 'rose' | 'lime'
  dot?: boolean
  className?: string
  title?: string
}) {
  return (
    <span className={cx('badge', `badge--${tone}`, className)} title={title}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

export function CategoryBadge({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? 'neutral'
  return (
    <Badge tone={color as never} dot>
      {category}
    </Badge>
  )
}

export function StageBadge({ stage }: { stage: Stage }) {
  const tone =
    stage === 'published' ? 'green' : stage === 'production' ? 'violet' : stage === 'script' ? 'amber' : stage === 'research' ? 'sky' : 'neutral'
  return <Badge tone={tone}>{stageLabel(stage)}</Badge>
}

export function stageLabel(stage: Stage): string {
  switch (stage) {
    case 'ideas':
      return 'Idea'
    case 'research':
      return 'Research'
    case 'script':
      return 'Script'
    case 'production':
      return 'Production'
    case 'published':
      return 'Published'
  }
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone = priority === 'high' ? 'red' : priority === 'medium' ? 'amber' : 'neutral'
  return <Badge tone={tone}>{priority}</Badge>
}

export function PublishStatusBadge({ status }: { status: PublishStatus }) {
  return <Badge tone={publishStatusTone(status)}>{PUBLISH_STATUS_META[status].label}</Badge>
}

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <Badge tone={contentStatusTone(status)}>{CONTENT_STATUS_META[status].label}</Badge>
}

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  return <Badge tone={campaignStatusTone(status)}>{CAMPAIGN_STATUS_META[status].label}</Badge>
}

type BadgeTone = 'neutral' | 'accent' | 'green' | 'amber' | 'red' | 'violet' | 'sky' | 'cyan' | 'pink' | 'emerald' | 'rose' | 'lime'

const ORIGIN_TONES: Record<ContentOrigin, BadgeTone> = {
  idea: 'accent',
  experiment: 'violet',
  research: 'sky',
  observation: 'cyan',
  opinion: 'pink',
  trend: 'amber',
  personal_experience: 'rose',
  direct: 'neutral',
}

export function OriginBadge({ origin, label }: { origin: ContentOrigin; label?: string }) {
  return <Badge tone={ORIGIN_TONES[origin] ?? 'neutral'}>{label ?? origin.replace(/_/g, ' ')}</Badge>
}

/* -------------------------------------------------------------------------- */
/* Form controls                                                              */
/* -------------------------------------------------------------------------- */
export function Field({ label, hint, children, className }: { label?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('field', className)}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input" {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input input--area" {...props} />
}

export function Select({
  width,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { width?: number | string }) {
  return (
    <div className="select" style={width !== undefined ? { width } : undefined}>
      <select className="select__control" {...props} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */
export function Card({ children, className, ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  )
}

export function CardHeader({ title, meta, actions }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card__header">
      <div className="card__header-main">
        <h3 className="card__title">{title}</h3>
        {meta && <div className="card__meta">{meta}</div>}
      </div>
      {actions && <div className="card__actions">{actions}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Score ring                                                                 */
/* -------------------------------------------------------------------------- */
export function ScoreRing({ value, max = 40, size = 56, label }: { value: number; max?: number; size?: number; label?: string }) {
  const pct = clamp(value / max, 0, 1)
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const color = value >= max * 0.7 ? 'var(--green)' : value >= max * 0.5 ? 'var(--accent)' : 'var(--amber)'
  return (
    <div className="score-ring" style={{ width: size, height: size }} title={label ? `${label}: ${value}/${max}` : `${value}/${max}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="score-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={4} />
        <circle
          className="score-ring__value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={4}
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="score-ring__num">{value}</span>
      {label && <span className="score-ring__label">{label}</span>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Score dimension bars                                                       */
/* -------------------------------------------------------------------------- */
export function DimensionBars({ values }: { values: { label: string; value: number }[] }) {
  return (
    <div className="dimbars">
      {values.map((d) => (
        <div key={d.label} className="dimbar">
          <div className="dimbar__top">
            <span className="dimbar__label">{d.label}</span>
            <span className="dimbar__value">{d.value}</span>
          </div>
          <div className="dimbar__track">
            <div className="dimbar__fill" style={{ width: `${(d.value / 10) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                */
/* -------------------------------------------------------------------------- */
export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty__icon">{icon}</div>}
      <p className="empty__title">{title}</p>
      {hint && <p className="empty__hint">{hint}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Spinner                                                                    */
/* -------------------------------------------------------------------------- */
export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} />
}

/* -------------------------------------------------------------------------- */
/* Drawer (right side panel)                                                  */
/* -------------------------------------------------------------------------- */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="drawer-root">
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width }} role="dialog" aria-modal="true">
        <header className="drawer__header">
          <div>
            <h2 className="drawer__title">{title}</h2>
            {subtitle && <p className="drawer__subtitle">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={<IconClose />} onClick={onClose} aria-label="Close" />
        </header>
        <div className="drawer__body">{children}</div>
        {footer && <footer className="drawer__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/*  Modal (centered dialog)                                                    */
/* -------------------------------------------------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 640,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-root">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal" style={{ width }} role="dialog" aria-modal="true">
        <header className="modal__header">
          <div>
            <h2 className="modal__title">{title}</h2>
            {subtitle && <p className="modal__subtitle">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={<IconClose />} onClick={onClose} aria-label="Close" />
        </header>
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

/* -------------------------------------------------------------------------- */
/*  Confirm                                                                    */
/* -------------------------------------------------------------------------- */
export function useConfirm() {
  return useUI((s) => s.requestConfirm)
}
