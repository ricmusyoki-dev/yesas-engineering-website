import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
  children?: ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const cancelButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButton.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault()
      onCancel()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>(
      'button:not(:disabled)',
    )
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!first || !last) {
      return
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <div
        aria-describedby="confirmation-description"
        aria-labelledby="confirmation-title"
        aria-modal="true"
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <h2 className="text-xl font-bold text-brand-navy" id="confirmation-title">
          {title}
        </h2>
        <p
          className="mt-3 text-sm leading-6 text-slate-600"
          id="confirmation-description"
        >
          {description}
        </p>
        {children}
        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
            disabled={busy}
            onClick={onCancel}
            ref={cancelButton}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={onConfirm}
            type="button"
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
