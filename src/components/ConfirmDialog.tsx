import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useUI } from '../store/uiStore'
import { Button } from './ui'

export function ConfirmDialog() {
  const message = useUI((s) => s.confirmMessage)
  const resolveConfirm = useUI((s) => s.resolveConfirm)

  useEffect(() => {
    if (!message) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') resolveConfirm(false)
      if (e.key === 'Enter') resolveConfirm(true)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [message, resolveConfirm])

  if (!message) return null

  return createPortal(
    <div className="confirm-root">
      <div className="confirm-overlay" onClick={() => resolveConfirm(false)} />
      <div className="confirm-box" role="alertdialog" aria-modal="true">
        <p className="confirm-box__message">{message}</p>
        <div className="confirm-box__actions">
          <Button variant="ghost" onClick={() => resolveConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => resolveConfirm(true)}>
            Confirm
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
