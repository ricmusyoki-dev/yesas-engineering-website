interface ErrorStateProps {
  message: string
  title?: string
}

export function ErrorState({
  message,
  title = 'Content could not be loaded',
}: ErrorStateProps) {
  return (
    <section
      className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-950"
      role="alert"
      aria-live="assertive"
    >
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-2">{message}</p>
    </section>
  )
}
