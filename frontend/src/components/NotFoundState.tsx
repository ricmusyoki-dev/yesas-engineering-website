import { Link } from 'react-router-dom'

interface NotFoundStateProps {
  message?: string
  title?: string
}

export function NotFoundState({
  message = 'The page you requested could not be found.',
  title = 'Page not found',
}: NotFoundStateProps) {
  return (
    <section className="space-y-4" aria-labelledby="not-found-title">
      <h1 id="not-found-title" className="text-3xl font-bold text-brand-navy">
        {title}
      </h1>
      <p className="text-slate-700">{message}</p>
      <Link
        className="inline-flex rounded-full bg-brand-navy px-5 py-3 font-semibold text-white transition-colors hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
        to="/"
      >
        Return to home
      </Link>
    </section>
  )
}
