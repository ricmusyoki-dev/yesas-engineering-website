import { useCallback } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CmsLink } from '../components/CmsLink'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { Media } from '../components/Media'
import { getService } from '../features/services/api'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { usePublicContent } from '../hooks/usePublicContent'
import { PageFrame } from './PageFrame'

function ServiceContentSection({
  title,
  content,
}: {
  title: string
  content: string
}) {
  if (!content.trim()) {
    return null
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-brand-navy">{title}</h2>
      <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
        {content}
      </p>
    </section>
  )
}

function ServiceListSection({
  title,
  items,
}: {
  title: string
  items: string[]
}) {
  const visibleItems = items.filter((item) => item.trim())
  if (visibleItems.length === 0) {
    return null
  }

  return (
    <section>
      <h2 className="text-xl font-bold text-brand-navy">{title}</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {visibleItems.map((item) => (
          <li
            className="rounded-xl border border-slate-200 bg-white p-4 leading-6 text-slate-700"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ServiceDetailPage() {
  const { slug = '' } = useParams()
  const loadService = useCallback(
    (signal: AbortSignal) => getService(slug, signal),
    [slug],
  )
  const state = usePublicContent(loadService)
  const service = state.status === 'success' ? state.data : null
  usePageMetadata(
    service?.seo_title.trim() ||
      (service ? `${service.title} | Services | Yesas Engineering` : 'Services | Yesas Engineering'),
    service?.seo_description.trim() || service?.summary,
  )

  return (
    <PageFrame title={service?.title ?? 'Service details'}>
      {state.status === 'loading' ? (
        <LoadingState message="Loading published service…" />
      ) : state.status === 'error' ? (
        state.error.status === 404 ? (
          <EmptyState
            title="Service not found"
            message="This service is not available in the published services catalogue."
          />
        ) : (
          <ErrorState message="Service details are temporarily unavailable. Please try again later." />
        )
      ) : (
        <article className="space-y-8">
          <Link
            className="inline-flex min-h-11 items-center font-semibold text-brand-blue hover:text-brand-orange"
            to="/services"
          >
            ← All services
          </Link>
          {state.data.category && (
            <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
              {state.data.category.name}
            </p>
          )}
          {state.data.summary && (
            <p className="max-w-3xl text-lg leading-8 text-slate-700">
              {state.data.summary}
            </p>
          )}
          {state.data.cover_image && (
            <div className="mx-auto max-w-5xl">
              <Media
                media={state.data.cover_image}
                presentation="gallery"
                priority
              />
            </div>
          )}
          <ServiceContentSection
            title="Overview"
            content={state.data.description}
          />
          <ServiceListSection title="Features" items={state.data.features} />
          <ServiceListSection title="Benefits" items={state.data.benefits} />
          <ServiceContentSection
            title="Our process"
            content={state.data.process}
          />

          {state.data.images.length > 0 && (
            <section aria-labelledby="service-gallery-heading">
              <h2
                className="text-xl font-bold text-brand-navy"
                id="service-gallery-heading"
              >
                Service gallery
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {state.data.images.map((image) => (
                  <li key={image.id}>
                    <Media media={image} presentation="gallery" />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.data.videos.length > 0 && (
            <section aria-labelledby="service-videos-heading">
              <h2
                className="text-xl font-bold text-brand-navy"
                id="service-videos-heading"
              >
                Service videos
              </h2>
              <ul className="mt-4 grid gap-4 lg:grid-cols-2">
                {state.data.videos.map((video) => (
                  <li key={video.id}>
                    <Media media={video} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {state.data.cta_label.trim() &&
            state.data.cta_destination.trim() && (
              <div className="border-t border-slate-200 pt-6">
                <CmsLink
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-brand-navy transition-colors hover:bg-brand-gold"
                  destination={state.data.cta_destination}
                >
                  {state.data.cta_label}
                </CmsLink>
              </div>
            )}
        </article>
      )}
    </PageFrame>
  )
}
