interface LoadingStateProps {
  message?: string
}

export function LoadingState({
  message = 'Loading content…',
}: LoadingStateProps) {
  return (
    <p className="text-slate-600" role="status" aria-live="polite">
      {message}
    </p>
  )
}
