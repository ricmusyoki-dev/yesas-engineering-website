import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Media } from '../components/Media'
import { ApiError } from '../lib/api/errors'
import type { PublicProject } from '../lib/api/types'
import { getProject } from '../features/projects/api'
import { PageFrame } from './PageFrame'

function displayDate(value: string | null): string | null {
  if (!value) {
    return null
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function ProjectSection({
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

export function ProjectDetailPage() {
  const { slug = '' } = useParams()
  const [project, setProject] = useState<PublicProject | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState<'not-found' | 'unavailable' | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${slug}:${attempt}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    getProject(slug, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) {
          return
        }
        setProject(result)
        setError(null)
        setLoadedKey(requestKey)
      })
      .catch((requestError: unknown) => {
        if (
          controller.signal.aborted ||
          requestError instanceof ApiError &&
          requestError.kind === 'aborted'
        ) {
          return
        }
        setError(
          requestError instanceof ApiError && requestError.status === 404
            ? 'not-found'
            : 'unavailable',
        )
        setProject(null)
        setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [slug, attempt, requestKey])

  return (
    <PageFrame title={project?.title ?? 'Project details'}>
      {loading ? (
        <p className="text-sm text-slate-600" role="status">
          Loading published project…
        </p>
      ) : error === 'not-found' ? (
        <EmptyState
          message="This project is not available in the published portfolio."
          title="Project not found"
        />
      ) : error || !project ? (
        <div role="alert">
          <EmptyState
            message="Project details are temporarily unavailable. Please try again."
            title="Project unavailable"
          />
          <button
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-navy"
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : (
        <article>
          <Link
            className="text-sm font-semibold text-brand-blue hover:text-brand-navy"
            to="/projects"
          >
            ← All projects
          </Link>
          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <div className="space-y-7">
              <header>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
                  {project.category?.name ?? 'Engineering project'}
                </p>
                <p className="mt-3 text-lg leading-7 text-slate-700">
                  {project.summary}
                </p>
                {(project.location ||
                  project.country ||
                  project.start_date ||
                  project.completion_date ||
                  project.client_name) && (
                  <dl className="mt-5 grid gap-4 border-y border-slate-200 py-4 sm:grid-cols-2">
                    {(project.location || project.country) && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Location
                        </dt>
                        <dd className="mt-1 text-sm text-brand-navy">
                          {[project.location, project.country]
                            .filter(Boolean)
                            .join(', ')}
                        </dd>
                      </div>
                    )}
                    {(project.start_date || project.completion_date) && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Project dates
                        </dt>
                        <dd className="mt-1 text-sm text-brand-navy">
                          {displayDate(project.start_date) ?? '—'} –{' '}
                          {displayDate(project.completion_date) ?? '—'}
                        </dd>
                      </div>
                    )}
                    {project.execution_status && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Status
                        </dt>
                        <dd className="mt-1 text-sm capitalize text-brand-navy">
                          {project.execution_status.replace('_', ' ')}
                        </dd>
                      </div>
                    )}
                    {project.client_name && (
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Client
                        </dt>
                        <dd className="mt-1 text-sm text-brand-navy">
                          {project.client_name}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </header>

              {project.cover_image && (
                <Media media={project.cover_image} presentation="gallery" priority />
              )}
              <ProjectSection title="Project overview" content={project.description} />
              <ProjectSection
                title="Background"
                content={project.project_background}
              />
              <ProjectSection
                title="Engineering challenge"
                content={project.engineering_challenge}
              />
              <ProjectSection
                title="Proposed solution"
                content={project.proposed_solution}
              />
              <ProjectSection
                title="Work carried out"
                content={project.work_carried_out}
              />
              <ProjectSection
                title="Technical specifications"
                content={project.technical_specifications}
              />
              <ProjectSection title="Outcomes" content={project.outcomes} />

              {project.images.length > 0 && (
                <section aria-labelledby="project-gallery-heading">
                  <h2
                    className="text-xl font-bold text-brand-navy"
                    id="project-gallery-heading"
                  >
                    Project gallery
                  </h2>
                  <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                    {project.images.map((image) => (
                      <li key={image.id}>
                        <Media media={image} presentation="gallery" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {project.videos.length > 0 && (
                <section aria-labelledby="project-videos-heading">
                  <h2
                    className="text-xl font-bold text-brand-navy"
                    id="project-videos-heading"
                  >
                    Project videos
                  </h2>
                  <ul className="mt-4 grid gap-4">
                    {project.videos.map((video) => (
                      <li key={video.id}>
                        <Media media={video} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside className="space-y-6">
              {project.tags.length > 0 && (
                <section aria-labelledby="project-tags-heading">
                  <h2
                    className="text-sm font-semibold uppercase tracking-wide text-slate-500"
                    id="project-tags-heading"
                  >
                    Project tags
                  </h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {project.tags.map((tag) => (
                      <li
                        className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700"
                        key={tag.slug}
                      >
                        {tag.name}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {project.related_services.length > 0 && (
                <section aria-labelledby="related-services-heading">
                  <h2
                    className="text-lg font-bold text-brand-navy"
                    id="related-services-heading"
                  >
                    Related services
                  </h2>
                  <ul className="mt-3 space-y-3">
                    {project.related_services.map((service) => (
                      <li key={service.slug}>
                        <Link
                          className="font-semibold text-brand-blue hover:text-brand-navy"
                          to={`/services/${encodeURIComponent(service.slug)}`}
                        >
                          {service.title}
                        </Link>
                        {service.summary && (
                          <p className="mt-1 text-sm leading-6 text-slate-600">
                            {service.summary}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </aside>
          </div>
        </article>
      )}
    </PageFrame>
  )
}
