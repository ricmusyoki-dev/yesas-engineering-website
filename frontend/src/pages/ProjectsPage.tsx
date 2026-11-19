import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState } from '../components/EmptyState'
import { Media } from '../components/Media'
import { ApiError } from '../lib/api/errors'
import type { PublicProject } from '../lib/api/types'
import { listProjects } from '../features/projects/api'
import { PageFrame } from './PageFrame'

const PAGE_SIZE = 10

function displayDate(value: string | null): string | null {
  if (!value) {
    return null
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 404) {
    return 'Published projects are not available right now.'
  }
  return 'Projects are temporarily unavailable. Please try again.'
}

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('page'))
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const category = searchParams.get('category') ?? ''
  const tag = searchParams.get('tag') ?? ''
  const requestedFeatured = searchParams.get('featured') ?? ''
  const featured =
    requestedFeatured === 'true' || requestedFeatured === 'false'
      ? requestedFeatured
      : ''
  const [projects, setProjects] = useState<PublicProject[]>([])
  const [count, setCount] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [loadedKey, setLoadedKey] = useState('')
  const requestKey = `${page}:${category}:${tag}:${featured}:${attempt}`
  const loading = loadedKey !== requestKey

  useEffect(() => {
    const controller = new AbortController()
    listProjects(
      {
        page,
        page_size: PAGE_SIZE,
        ...(category ? { category } : {}),
        ...(tag ? { tag } : {}),
        ...(featured ? { featured: featured === 'true' } : {}),
      },
      controller.signal,
    )
      .then((response) => {
        if (controller.signal.aborted) {
          return
        }
        setProjects(response.results)
        setCount(response.count)
        setError('')
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
        setError(errorMessage(requestError))
        setProjects([])
        setCount(0)
        setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [page, category, tag, featured, attempt, requestKey])

  const categories = useMemo(
    () =>
      Array.from(
        new Map(
          projects.flatMap((project) =>
            project.category
              ? [[project.category.slug, project.category.name] as const]
              : [],
          ),
        ),
      ),
    [projects],
  )
  const tags = useMemo(
    () =>
      Array.from(
        new Map(
          projects.flatMap((project) =>
            project.tags.map((projectTag) => [
              projectTag.slug,
              projectTag.name,
            ]),
          ),
        ),
      ),
    [projects],
  )
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  function updateFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    next.delete('page')
    setSearchParams(next)
  }

  function changePage(nextPage: number) {
    const next = new URLSearchParams(searchParams)
    if (nextPage === 1) {
      next.delete('page')
    } else {
      next.set('page', String(nextPage))
    }
    setSearchParams(next)
  }

  return (
    <PageFrame title="Projects">
      <p className="max-w-3xl leading-7 text-slate-600">
        Explore engineering projects delivered by Yesas Engineering.
      </p>

      <section
        aria-label="Filter projects"
        className="mt-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3"
      >
        <label className="text-sm font-semibold text-slate-700">
          Category
          <select
            className="public-control mt-1 block w-full font-normal"
            onChange={(event) => updateFilter('category', event.target.value)}
            value={category}
          >
            <option value="">All categories</option>
            {category &&
              !categories.some(([slug]) => slug === category) && (
                <option value={category}>{category}</option>
              )}
            {categories.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Tag
          <select
            className="public-control mt-1 block w-full font-normal"
            onChange={(event) => updateFilter('tag', event.target.value)}
            value={tag}
          >
            <option value="">All tags</option>
            {tag && !tags.some(([slug]) => slug === tag) && (
              <option value={tag}>{tag}</option>
            )}
            {tags.map(([slug, name]) => (
              <option key={slug} value={slug}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Featured
          <select
            className="public-control mt-1 block w-full font-normal"
            onChange={(event) => updateFilter('featured', event.target.value)}
            value={featured}
          >
            <option value="">All projects</option>
            <option value="true">Featured only</option>
            <option value="false">Not featured</option>
          </select>
        </label>
      </section>

      {loading ? (
        <p className="mt-8 text-sm text-slate-600" role="status">
          Loading published projects…
        </p>
      ) : error ? (
        <div className="mt-8">
          <EmptyState message={error} title="Projects unavailable" />
          <button
            className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-brand-navy"
            onClick={() => setAttempt((value) => value + 1)}
            type="button"
          >
            Retry
          </button>
        </div>
      ) : projects.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            message={
              count === 0 && !category && !tag && !featured
                ? 'There are no published projects yet.'
                : 'No published projects match these filters.'
            }
            title="No projects found"
          />
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, count)} of {count} projects
          </p>
          <ul className="mt-4 grid gap-6 md:grid-cols-2">
            {projects.map((project) => {
              const date = displayDate(
                project.completion_date ?? project.start_date,
              )
              return (
                <li
                  className="public-card group"
                  key={project.slug}
                >
                  {project.cover_image && (
                    <Link
                      aria-label={`View ${project.title}`}
                      className="block overflow-hidden"
                      to={`/projects/${encodeURIComponent(project.slug)}`}
                    >
                      <Media media={project.cover_image} presentation="card" />
                    </Link>
                  )}
                  <div className="p-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">
                      {project.category?.name ?? 'Engineering project'}
                      {date ? ` · ${date}` : ''}
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-brand-navy">
                      <Link
                        className="hover:text-brand-blue"
                        to={`/projects/${encodeURIComponent(project.slug)}`}
                      >
                        {project.title}
                      </Link>
                    </h2>
                    {(project.location || project.country) && (
                      <p className="mt-1 text-sm text-slate-500">
                        {[project.location, project.country]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    )}
                    <p className="mt-3 leading-6 text-slate-600">
                      {project.summary}
                    </p>
                    {project.tags.length > 0 && (
                      <ul
                        aria-label="Project tags"
                        className="mt-4 flex flex-wrap gap-2"
                      >
                        {project.tags.map((projectTag) => (
                          <li
                            className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                            key={projectTag.slug}
                          >
                            {projectTag.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    <Link
                      className="mt-5 inline-flex font-semibold text-brand-blue hover:text-brand-navy"
                      to={`/projects/${encodeURIComponent(project.slug)}`}
                    >
                      View project <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
          {pageCount > 1 && (
            <nav
              aria-label="Project pages"
              className="mt-8 flex items-center justify-between"
            >
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => changePage(page - 1)}
                type="button"
              >
                Previous
              </button>
              <p className="text-sm text-slate-600">
                Page {page} of {pageCount}
              </p>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                disabled={page >= pageCount}
                onClick={() => changePage(page + 1)}
                type="button"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </PageFrame>
  )
}
