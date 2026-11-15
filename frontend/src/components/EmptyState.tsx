interface EmptyStateProps {
  message: string
  title?: string
}

export function EmptyState({
  message,
  title = 'No content available',
}: EmptyStateProps) {
  return (
    <section
      className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-700"
      role="status"
      aria-live="polite"
    >
      <h2 className="font-semibold text-brand-navy">{title}</h2>
      <p className="mt-2">{message}</p>
    </section>
  )
}
