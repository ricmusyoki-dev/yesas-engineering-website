import {
  useEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

interface ContentPreviewDialogProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export function ContentPreviewDialog({
  title,
  onClose,
  children,
}: ContentPreviewDialogProps) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'Tab') {
      const focusable =
        event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), video[controls]',
        )
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first && last) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last && first) {
        event.preventDefault()
        first.focus()
      }
    }
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/60 p-4 sm:p-8">
      <div
        aria-labelledby="content-preview-title"
        aria-modal="true"
        className="mx-auto my-6 max-w-4xl rounded-2xl bg-white p-5 shadow-2xl sm:p-8"
        onKeyDown={handleKeyDown}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
              Draft preview
            </p>
            <h2
              className="mt-1 text-2xl font-bold text-brand-navy"
              id="content-preview-title"
            >
              {title}
            </h2>
          </div>
          <button
            aria-label="Close preview"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            onClick={onClose}
            ref={closeButton}
            type="button"
          >
            Close
          </button>
        </div>
        <div className="pt-6">{children}</div>
      </div>
    </div>
  )
}
