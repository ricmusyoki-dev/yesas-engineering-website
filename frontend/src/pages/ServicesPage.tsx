import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { Media } from '../components/Media'
import { listServices } from '../features/services/api'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { usePublicContent } from '../hooks/usePublicContent'
import type { PublicService } from '../lib/api/types'
import { PageFrame } from './PageFrame'

function ServiceCard({ service }: { service: PublicService }) {
  const servicePath = `/services/${encodeURIComponent(service.slug)}`

  return (
    <article className="public-card group flex h-full flex-col">
      {service.cover_image && (
        <Link
          aria-label={`View ${service.title}`}
          className="block overflow-hidden"
          to={servicePath}
        >
          <Media media={service.cover_image} presentation="card" />
        </Link>
      )}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        {service.category && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
            {service.category.name}
          </p>
        )}
        <h2 className="mt-2 text-xl font-bold text-brand-navy">
          <Link
            className="rounded-sm hover:text-brand-blue"
            to={servicePath}
          >
            {service.title}
          </Link>
        </h2>
        {service.summary && (
          <p className="mt-3 flex-1 leading-7 text-slate-700">
            {service.summary}
          </p>
        )}
        <Link
          className="mt-5 inline-flex min-h-11 w-fit items-center gap-2 font-semibold text-brand-blue hover:text-brand-orange"
          to={servicePath}
        >
          View service <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  )
}

export function ServicesPage() {
  const loadServices = useCallback(
    (signal: AbortSignal) => listServices({}, signal),
    [],
  )
  const state = usePublicContent(loadServices)
  usePageMetadata('Services | Yesas Engineering')

  return (
    <PageFrame title="Services">
      <p className="max-w-3xl leading-7 text-slate-600">
        Explore the services published by Yesas Engineering.
      </p>
      {state.status === 'loading' ? (
        <div className="mt-8">
          <LoadingState message="Loading published services…" />
        </div>
      ) : state.status === 'error' ? (
        <div className="mt-8">
          <ErrorState message="Published services are temporarily unavailable. Please try again later." />
        </div>
      ) : state.data.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="No services available"
            message="There are no published services available at this time."
          />
        </div>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {state.data
            .slice()
            .sort((left, right) => left.display_order - right.display_order)
            .map((service) => (
              <li key={service.slug}>
                <ServiceCard service={service} />
              </li>
            ))}
        </ul>
      )}
    </PageFrame>
  )
}
