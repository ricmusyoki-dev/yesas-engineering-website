import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { Media } from '../../components/Media'
import { RevisionStatusBadge } from '../cms/RevisionStatusBadge'
import { listAttachments } from '../cms/mediaApi'
import type {
  ManagementService,
  MediaAttachment,
  RevisionStatus,
} from '../cms/types'
import type { PublicProject } from '../../lib/api/types'
import { listProjects as listPublicProjects } from './api'
import { ProjectEditor, type ProjectFormValues } from './ProjectEditor'
import { ProjectTaxonomyPanel } from './ProjectTaxonomyPanel'
import {
  archiveProject,
  createProject,
  createProjectDraft,
  discardProjectDraft,
  getProjectDraft,
  listManagementServices,
  listProjectCategories,
  listProjectRevisions,
  listProjectTags,
  listProjects,
  previewProjectDraft,
  publishProjectDraft,
  restoreProjectRevision,
  setProjectAvailability,
  updateProjectDraft,
  type ProjectCategory,
  type ProjectFields,
  type ProjectManagementRecord,
  type ProjectRevision,
  type ProjectTag,
} from './managementApi'

type StatusFilter = 'all' | 'draft' | 'published' | 'disabled' | 'archived'

type Confirmation =
  | { kind: 'publish'; slug: string }
  | { kind: 'discard'; slug: string }
  | { kind: 'archive'; project: ProjectManagementRecord }
  | {
      kind: 'availability'
      project: ProjectManagementRecord
      availability: 'enabled' | 'disabled'
    }
  | { kind: 'restore'; slug: string; revision: ProjectRevision }

interface EditorState {
  slug: string
  revision: ProjectRevision | null
}

const EMPTY_FIELDS: ProjectFields = {
  title: '',
  summary: '',
  description: '',
  category: null,
  location: '',
  country: '',
  start_date: null,
  completion_date: null,
  execution_status: '',
  project_background: '',
  engineering_challenge: '',
  proposed_solution: '',
  work_carried_out: '',
  technical_specifications: '',
  outcomes: '',
  related_services: [],
  tags: [],
  display_order: 0,
  is_featured: false,
  client_name: '',
  show_client_name: false,
  seo_title: '',
  seo_description: '',
}

function messageFor(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The project request could not be completed. Please try again.'
}

function fieldsFromRevision(revision: ProjectRevision): ProjectFormValues {
  return {
    slug: revision.slug,
    title: revision.title,
    summary: revision.summary,
    description: revision.description,
    category: revision.category,
    location: revision.location,
    country: revision.country,
    start_date: revision.start_date,
    completion_date: revision.completion_date,
    execution_status: revision.execution_status,
    project_background: revision.project_background,
    engineering_challenge: revision.engineering_challenge,
    proposed_solution: revision.proposed_solution,
    work_carried_out: revision.work_carried_out,
    technical_specifications: revision.technical_specifications,
    outcomes: revision.outcomes,
    related_services: revision.related_services,
    tags: revision.tags,
    display_order: revision.display_order,
    is_featured: revision.is_featured,
    client_name: revision.client_name,
    show_client_name: revision.show_client_name,
    seo_title: revision.seo_title,
    seo_description: revision.seo_description,
  }
}

function fieldsFromForm(form: ProjectFormValues): ProjectFields {
  const { slug: _slug, ...fields } = form
  return fields
}

function displayDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function categoryName(
  categories: ProjectCategory[],
  categoryId: number | null,
): string {
  if (categoryId === null) {
    return 'Uncategorized'
  }
  const category = categories.find((item) => item.id === categoryId)
  return category
    ? `${category.name}${category.is_active ? '' : ' (inactive)'}`
    : `Category ${categoryId}`
}

function currentRevision(
  project: ProjectManagementRecord,
): ProjectRevision | null {
  return project.draft ?? project.published
}

function cardStatus(project: ProjectManagementRecord): {
  label: string
  revisionStatus?: RevisionStatus
} {
  if (project.availability === 'archived') {
    return { label: 'Archived', revisionStatus: 'archived' }
  }
  if (project.draft) {
    return { label: 'Draft', revisionStatus: 'draft' }
  }
  if (project.availability === 'disabled') {
    return { label: 'Disabled' }
  }
  if (project.published) {
    return { label: 'Published', revisionStatus: 'published' }
  }
  return { label: 'No revision' }
}

async function loadPublicCovers(): Promise<Map<string, PublicProject['cover_image']>> {
  const pageSize = 100
  const firstPage = await listPublicProjects({ page: 1, page_size: pageSize })
  const pageCount = Math.ceil(firstPage.count / pageSize)
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      listPublicProjects({ page: index + 2, page_size: pageSize }),
    ),
  )
  return new Map(
    [firstPage, ...remainingPages]
      .flatMap((page) => page.results)
      .map((project) => [project.slug, project.cover_image]),
  )
}

function ProjectDetails({
  revision,
  categories,
  tags,
}: {
  revision: ProjectRevision
  categories: ProjectCategory[]
  tags: ProjectTag[]
}) {
  const executionStatus: string = {
    '': '',
    planning: 'Planning',
    in_progress: 'In progress',
    completed: 'Completed',
    on_hold: 'On hold',
  }[revision.execution_status]

  return (
    <div className="mt-4 grid gap-5 border-t border-slate-100 pt-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <p className="text-sm font-semibold text-brand-blue">
          {categoryName(categories, revision.category)}
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          {revision.summary || 'No summary saved.'}
        </p>
        {revision.description && (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {revision.description}
          </p>
        )}
      </div>
      {(revision.location || revision.country) && (
        <div>
          <h4 className="text-sm font-semibold">Location</h4>
          <p className="mt-1 text-sm text-slate-600">
            {[revision.location, revision.country].filter(Boolean).join(', ')}
          </p>
        </div>
      )}
      {(revision.start_date || revision.completion_date) && (
        <div>
          <h4 className="text-sm font-semibold">Project dates</h4>
          <p className="mt-1 text-sm text-slate-600">
            {displayDate(revision.start_date)} –{' '}
            {displayDate(revision.completion_date)}
          </p>
        </div>
      )}
      {executionStatus && (
        <div>
          <h4 className="text-sm font-semibold">Execution status</h4>
          <p className="mt-1 text-sm text-slate-600">{executionStatus}</p>
        </div>
      )}
      {revision.tags.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Tags</h4>
          <ul className="mt-2 flex flex-wrap gap-2">
            {revision.tags.map((id) => (
              <li
                className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                key={id}
              >
                {tags.find((tag) => tag.id === id)?.name ?? `Tag ${id}`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {revision.client_name && (
        <div>
          <h4 className="text-sm font-semibold">Client</h4>
          <p className="mt-1 text-sm text-slate-600">
            {revision.client_name}
            {revision.show_client_name
              ? ' · visible publicly'
              : ' · private on public pages'}
          </p>
        </div>
      )}
      <dl className="grid gap-2 text-sm sm:col-span-2 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Display order</dt>
          <dd className="text-slate-600">{revision.display_order}</dd>
        </div>
        <div>
          <dt className="font-semibold">Featured</dt>
          <dd className="text-slate-600">
            {revision.is_featured ? 'Yes' : 'No'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Last saved</dt>
          <dd className="text-slate-600">
            {displayDate(revision.updated_at.slice(0, 10))}
          </dd>
        </div>
      </dl>
    </div>
  )
}

export function ProjectsManagementPage() {
  const [projects, setProjects] = useState<ProjectManagementRecord[]>([])
  const [categories, setCategories] = useState<ProjectCategory[]>([])
  const [tags, setTags] = useState<ProjectTag[]>([])
  const [services, setServices] = useState<ManagementService[]>([])
  const [publicCovers, setPublicCovers] = useState<
    Map<string, PublicProject['cover_image']>
  >(new Map())
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [tagError, setTagError] = useState('')
  const [serviceOptionsError, setServiceOptionsError] = useState('')
  const [coverError, setCoverError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [form, setForm] = useState<ProjectFormValues | null>(null)
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [preview, setPreview] = useState<ProjectRevision | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [historySlug, setHistorySlug] = useState<string | null>(null)
  const [history, setHistory] = useState<ProjectRevision[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')

  const dirty = useMemo(
    () => {
      if (!editor || !form) {
        return false
      }
      if (!editor.revision) {
        return JSON.stringify(form) !== JSON.stringify({ slug: '', ...EMPTY_FIELDS })
      }
      return (
        JSON.stringify(
          fieldsFromForm(fieldsFromRevision(editor.revision)),
        ) !== JSON.stringify(fieldsFromForm(form))
      )
    },
    [editor, form],
  )

  async function refreshProjects(): Promise<void> {
    setLoadError('')
    try {
      setProjects(await listProjects())
    } catch (requestError) {
      setLoadError(messageFor(requestError))
    }
  }

  async function refreshTaxonomy(): Promise<void> {
    const [categoryResult, tagResult] = await Promise.allSettled([
      listProjectCategories(),
      listProjectTags(),
    ])
    if (categoryResult.status === 'fulfilled') {
      setCategories(categoryResult.value)
      setCategoryError('')
    } else {
      setCategoryError(messageFor(categoryResult.reason))
    }
    if (tagResult.status === 'fulfilled') {
      setTags(tagResult.value)
      setTagError('')
    } else {
      setTagError(messageFor(tagResult.reason))
    }
  }

  async function refreshPublicCovers(): Promise<void> {
    setCoverError('')
    try {
      setPublicCovers(await loadPublicCovers())
    } catch (requestError) {
      setCoverError(messageFor(requestError))
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      setCategoryError('')
      setTagError('')
      setServiceOptionsError('')
      setCoverError('')
      const [
        projectResult,
        categoryResult,
        tagResult,
        servicesResult,
        coverResult,
      ] = await Promise.allSettled([
        listProjects(),
        listProjectCategories(),
        listProjectTags(),
        listManagementServices(),
        loadPublicCovers(),
      ])
      if (!active) {
        return
      }
      if (projectResult.status === 'fulfilled') {
        setProjects(projectResult.value)
      } else {
        setLoadError(messageFor(projectResult.reason))
      }
      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value)
      } else {
        setCategoryError(messageFor(categoryResult.reason))
      }
      if (tagResult.status === 'fulfilled') {
        setTags(tagResult.value)
      } else {
        setTagError(messageFor(tagResult.reason))
      }
      if (servicesResult.status === 'fulfilled') {
        setServices(servicesResult.value)
      } else {
        setServiceOptionsError(messageFor(servicesResult.reason))
      }
      if (coverResult.status === 'fulfilled') {
        setPublicCovers(coverResult.value)
      } else {
        setCoverError(messageFor(coverResult.reason))
      }
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [loadAttempt])

  async function loadAttachments(revisionId: number): Promise<void> {
    setAttachmentError('')
    try {
      setAttachments(await listAttachments('project_revision', revisionId))
    } catch (requestError) {
      setAttachmentError(messageFor(requestError))
    }
  }

  function startNewProject() {
    if (dirty) {
      setActionError('Save or discard local changes before switching projects.')
      return
    }
    setEditor({ slug: '', revision: null })
    setForm({ slug: '', ...EMPTY_FIELDS })
    setAttachments([])
    setAttachmentError('')
    setActionError('')
    setNotice('')
    setPreview(null)
  }

  async function openProjectEditor(project: ProjectManagementRecord) {
    if (dirty) {
      setActionError('Save or discard local changes before switching projects.')
      return
    }
    if (project.availability === 'archived') {
      setActionError('Archived projects cannot be edited or published.')
      return
    }
    setOpening(project.slug)
    setActionError('')
    setNotice('')
    try {
      let draft: ProjectRevision
      if (project.draft) {
        draft = await getProjectDraft(project.slug)
      } else {
        try {
          draft = await createProjectDraft(project.slug)
        } catch (createError) {
          if (
            !(createError instanceof SessionApiError) ||
            createError.status !== 409
          ) {
            throw createError
          }
          draft = await getProjectDraft(project.slug)
        }
      }
      setEditor({ slug: project.slug, revision: draft })
      setForm(fieldsFromRevision(draft))
      setAttachments([])
      setPreview(null)
      await Promise.all([loadAttachments(draft.id), refreshProjects()])
    } catch (requestError) {
      setActionError(messageFor(requestError))
    } finally {
      setOpening(null)
    }
  }

  function changeField<Key extends keyof ProjectFormValues>(
    key: Key,
    value: ProjectFormValues[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || !form) {
      return
    }
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      if (!editor.revision) {
        const created = await createProject({
          ...fieldsFromForm(form),
          slug: form.slug.trim(),
        })
        if (!created.draft) {
          throw new SessionApiError(
            'The project was created without a draft revision in the response.',
            'invalid-json',
            201,
          )
        }
        setEditor({ slug: created.slug, revision: created.draft })
        setForm(fieldsFromRevision(created.draft))
        setNotice('Project draft created.')
        await Promise.all([
          loadAttachments(created.draft.id),
          refreshProjects(),
        ])
      } else {
        const updated = await updateProjectDraft(
          editor.slug,
          fieldsFromForm(form),
        )
        setEditor({ ...editor, revision: updated })
        setForm(fieldsFromRevision(updated))
        setNotice('Project draft saved.')
        await refreshProjects()
      }
    } catch (requestError) {
      setActionError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function openPreview() {
    if (!editor || !form || dirty) {
      return
    }
    setActionError('')
    try {
      setPreview(await previewProjectDraft(editor.slug))
    } catch (requestError) {
      setActionError(messageFor(requestError))
    }
  }

  async function showHistory(slug: string) {
    if (historySlug === slug) {
      setHistorySlug(null)
      setHistory([])
      return
    }
    setHistoryLoading(true)
    setHistoryError('')
    setHistorySlug(slug)
    try {
      setHistory(await listProjectRevisions(slug))
    } catch (requestError) {
      setHistoryError(messageFor(requestError))
      setHistory([])
    } finally {
      setHistoryLoading(false)
    }
  }

  async function confirmAction() {
    if (!confirmation) {
      return
    }
    if (confirmation.kind === 'restore' && dirty) {
      setActionError('Save or discard local changes before restoring a revision.')
      return
    }
    const affectedSlug =
      confirmation.kind === 'archive' ||
      confirmation.kind === 'availability'
        ? confirmation.project.slug
        : confirmation.slug
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      if (confirmation.kind === 'publish') {
        await publishProjectDraft(confirmation.slug)
        setNotice(`Project “${confirmation.slug}” published.`)
        setEditor(null)
        setForm(null)
        setAttachments([])
        await refreshPublicCovers()
      } else if (confirmation.kind === 'discard') {
        await discardProjectDraft(confirmation.slug)
        setNotice(`Draft for “${confirmation.slug}” discarded.`)
        setEditor(null)
        setForm(null)
        setAttachments([])
      } else if (confirmation.kind === 'archive') {
        await archiveProject(confirmation.project.slug)
        setNotice(`Project “${confirmation.project.slug}” archived.`)
        if (editor?.slug === confirmation.project.slug) {
          setEditor(null)
          setForm(null)
          setAttachments([])
        }
        await refreshPublicCovers()
      } else if (confirmation.kind === 'availability') {
        await setProjectAvailability(
          confirmation.project.slug,
          confirmation.availability,
        )
        setNotice(
          `Project “${confirmation.project.slug}” is now ${confirmation.availability}.`,
        )
        await refreshPublicCovers()
      } else {
        const restored = await restoreProjectRevision(
          confirmation.slug,
          confirmation.revision.id,
        )
        setEditor({ slug: confirmation.slug, revision: restored })
        setForm(fieldsFromRevision(restored))
        setAttachments([])
        setNotice('Archived revision restored as a new draft.')
        await loadAttachments(restored.id)
      }
      setConfirmation(null)
      await refreshProjects()
      if (historySlug === affectedSlug) {
        try {
          setHistory(await listProjectRevisions(affectedSlug))
          setHistoryError('')
        } catch (requestError) {
          setHistoryError(messageFor(requestError))
        }
      }
    } catch (requestError) {
      setActionError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  const filteredProjects = projects.filter((project) => {
    const revision = currentRevision(project)
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      project.slug.toLowerCase().includes(query) ||
      revision?.title.toLowerCase().includes(query) ||
      revision?.summary.toLowerCase().includes(query) ||
      revision?.location.toLowerCase().includes(query) ||
      revision?.country.toLowerCase().includes(query)
    const matchesCategory =
      categoryFilter === 'all' ||
      String(revision?.category ?? '') === categoryFilter
    const matchesTag =
      tagFilter === 'all' ||
      Boolean(revision?.tags.includes(Number(tagFilter)))
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'archived' &&
        project.availability === 'archived') ||
      (statusFilter === 'disabled' &&
        project.availability === 'disabled') ||
      (statusFilter === 'draft' &&
        project.availability !== 'archived' &&
        Boolean(project.draft)) ||
      (statusFilter === 'published' &&
        project.availability !== 'archived' &&
        Boolean(project.published))
    return matchesSearch && matchesCategory && matchesTag && matchesStatus
  })

  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Loading projects…
      </p>
    )
  }

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Website management
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Projects Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Manage project stories, categories, tags and revision media. Drafts
            remain private until you explicitly publish them.
          </p>
        </div>
        <button
          className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
          disabled={busy || Boolean(opening)}
          onClick={startNewProject}
          type="button"
        >
          Create project
        </button>
      </div>

      {loadError && (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
          {loadError}{' '}
          <button
            className="font-semibold underline underline-offset-2"
            onClick={() => setLoadAttempt((attempt) => attempt + 1)}
            type="button"
          >
            Retry
          </button>
        </p>
      )}
      {categoryError && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          Categories could not be loaded: {categoryError}
        </p>
      )}
      {tagError && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          Tags could not be loaded: {tagError}
        </p>
      )}
      {serviceOptionsError && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          Related service choices could not be loaded: {serviceOptionsError}
        </p>
      )}
      {coverError && (
        <p className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          Public cover thumbnails could not be loaded: {coverError}
        </p>
      )}
      {actionError && (
        <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
          {actionError}
        </p>
      )}
      {notice && !editor && (
        <p className="mt-4 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      )}

      {editor && form && (
        <ProjectEditor
          attachments={attachments}
          attachmentError={attachmentError}
          busy={busy}
          categories={categories}
          dirty={dirty}
          form={form}
          notice={notice}
          onAttachmentsChange={setAttachments}
          onChange={changeField}
          onClose={() => {
            if (dirty) {
              setActionError(
                'Save or discard local changes before closing the editor.',
              )
              return
            }
            setEditor(null)
            setForm(null)
            setAttachments([])
            setPreview(null)
          }}
          onClosePreview={() => setPreview(null)}
          onDiscard={() =>
            setConfirmation({ kind: 'discard', slug: editor.slug })
          }
          onPreview={() => void openPreview()}
          onPublish={() =>
            setConfirmation({ kind: 'publish', slug: editor.slug })
          }
          onSave={(event) => void saveDraft(event)}
          preview={preview}
          revision={editor.revision}
          services={services}
          tags={tags}
        />
      )}

      <section
        aria-labelledby="projects-list-heading"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" id="projects-list-heading">
              Projects
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {filteredProjects.length} of {projects.length} project
              {projects.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
            <label className="text-xs font-semibold text-slate-600">
              Search
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-brand-navy"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, summary, location, or slug"
                type="search"
                value={search}
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Category
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-brand-navy"
                onChange={(event) => setCategoryFilter(event.target.value)}
                value={categoryFilter}
              >
                <option value="all">All categories</option>
                <option value="">Uncategorized</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                    {!category.is_active ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Tag
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-brand-navy"
                onChange={(event) => setTagFilter(event.target.value)}
                value={tagFilter}
              >
                <option value="all">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                    {!tag.is_active ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Status
              <select
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-brand-navy"
                onChange={(event) =>
                  setStatusFilter(event.target.value as StatusFilter)
                }
                value={statusFilter}
              >
                <option value="all">All statuses</option>
                <option value="draft">Has draft</option>
                <option value="published">Has published revision</option>
                <option value="disabled">Disabled projects</option>
                <option value="archived">Archived projects</option>
              </select>
            </label>
          </div>
        </div>

        {loadError ? null : projects.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
            <h3 className="font-semibold text-brand-navy">No projects yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Create a project draft to start managing the portfolio.
            </p>
            <button
              className="mt-4 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue"
              onClick={startNewProject}
              type="button"
            >
              Create project
            </button>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">
              No projects match these filters.
            </p>
            <button
              className="mt-3 text-sm font-semibold text-brand-blue underline underline-offset-2"
              onClick={() => {
                setSearch('')
                setCategoryFilter('all')
                setTagFilter('all')
                setStatusFilter('all')
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-slate-200">
            {filteredProjects.map((project) => {
              const status = cardStatus(project)
              const current = currentRevision(project)
              const cover = publicCovers.get(project.slug)
              const date = current?.completion_date ?? current?.start_date
              return (
                <li className="py-5" key={project.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 gap-4">
                      {cover && (
                        <div className="hidden w-36 shrink-0 sm:block">
                          <Media media={cover} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-lg font-semibold text-brand-navy">
                            {current?.title || project.slug}
                          </h3>
                          {status.revisionStatus ? (
                            <RevisionStatusBadge
                              status={status.revisionStatus}
                            />
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {status.label}
                            </span>
                          )}
                          {project.published && project.draft && (
                            <span className="text-xs text-slate-500">
                              Live version remains unchanged
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          /{project.slug}
                          {current
                            ? ` · ${categoryName(categories, current.category)}`
                            : ''}
                          {date ? ` · ${displayDate(date)}` : ''}
                        </p>
                        <p className="mt-2 max-w-3xl text-sm text-slate-600">
                          {current?.summary || 'No summary saved.'}
                        </p>
                        {project.published && project.draft && (
                          <p className="mt-2 text-xs text-slate-500">
                            Currently live: {project.published.title || project.slug}
                          </p>
                        )}
                        {project.availability === 'disabled' && (
                          <p className="mt-2 text-xs text-amber-800">
                            This published project is hidden from the public
                            portfolio until enabled.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                        disabled={
                          Boolean(opening) ||
                          busy ||
                          project.availability === 'archived'
                        }
                        onClick={() => void openProjectEditor(project)}
                        type="button"
                      >
                        {opening === project.slug
                          ? 'Opening…'
                          : project.draft
                            ? 'Edit draft'
                            : project.availability === 'archived'
                              ? 'Archived'
                              : project.published
                                ? 'Edit as draft'
                                : 'Create draft'}
                      </button>
                      {project.published &&
                        project.availability !== 'archived' && (
                          <button
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                              disabled={busy}
                              onClick={() =>
                                setConfirmation({
                                  kind: 'availability',
                                  project,
                                  availability:
                                    project.availability === 'enabled'
                                      ? 'disabled'
                                      : 'enabled',
                                })
                              }
                              type="button"
                            >
                              {project.availability === 'enabled'
                                ? 'Disable'
                                : 'Enable'}
                          </button>
                        )}
                      {project.availability !== 'archived' && (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                          disabled={
                            busy ||
                            (editor?.slug === project.slug && dirty)
                          }
                          onClick={() =>
                            setConfirmation({ kind: 'archive', project })
                          }
                          type="button"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                        disabled={historyLoading}
                        onClick={() => void showHistory(project.slug)}
                        type="button"
                      >
                        {historySlug === project.slug
                          ? 'Hide history'
                          : 'Revision history'}
                      </button>
                    </div>
                  </div>

                  {current && (
                    <details className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                        View project details
                      </summary>
                      {project.availability === 'archived' && (
                        <p className="mt-3 text-sm text-amber-900">
                          This project is permanently archived and is not public.
                          The backend provides no unarchive operation.
                        </p>
                      )}
                      <ProjectDetails
                        categories={categories}
                        revision={current}
                        tags={tags}
                      />
                    </details>
                  )}

                  {historySlug === project.slug && (
                    <div className="mt-4 rounded-lg border border-slate-200 p-4">
                      <h4 className="font-semibold text-brand-navy">
                        Revision history
                      </h4>
                      {historyError && (
                        <p className="mt-3 text-sm text-red-800" role="alert">
                          {historyError}
                        </p>
                      )}
                      {historyLoading ? (
                        <p className="mt-3 text-sm text-slate-600" role="status">
                          Loading revision history…
                        </p>
                      ) : history.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-500">
                          No revisions are available.
                        </p>
                      ) : (
                        <ul className="mt-3 divide-y divide-slate-100">
                          {history.map((revision) => (
                            <li
                              className="flex flex-wrap items-center justify-between gap-3 py-3"
                              key={revision.id}
                            >
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-semibold">
                                  Revision #{revision.id} ·{' '}
                                  {revision.title || revision.slug}
                                </span>
                                <RevisionStatusBadge status={revision.status} />
                                <span className="text-xs text-slate-500">
                                  Updated {displayDate(revision.updated_at.slice(0, 10))}
                                </span>
                              </div>
                              {revision.status === 'archived' && (
                                <button
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                                  disabled={
                                    busy ||
                                    dirty ||
                                    Boolean(project.draft) ||
                                    project.availability === 'archived'
                                  }
                                  onClick={() =>
                                    setConfirmation({
                                      kind: 'restore',
                                      slug: project.slug,
                                      revision,
                                    })
                                  }
                                  type="button"
                                >
                                  Restore as draft
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ProjectTaxonomyPanel
        categories={categories}
        onTaxonomyChanged={refreshTaxonomy}
        tags={tags}
      />

      {confirmation && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            confirmation.kind === 'publish'
              ? 'Publish project'
              : confirmation.kind === 'discard'
                ? 'Discard draft'
                : confirmation.kind === 'archive'
                  ? 'Archive project'
                  : confirmation.kind === 'availability'
                    ? confirmation.availability === 'enabled'
                      ? 'Enable project'
                      : 'Disable project'
                    : 'Restore as draft'
          }
          description={
            confirmation.kind === 'publish'
              ? `Publishing “${confirmation.slug}” makes the saved draft live and archives the previous published revision.`
              : confirmation.kind === 'discard'
                ? `This deletes the saved draft for “${confirmation.slug}”. Any published revision remains unchanged.`
                : confirmation.kind === 'archive'
                    ? `Archiving “${confirmation.project.slug}” is permanent; the backend has no unarchive operation. A published revision is immediately removed from the public portfolio, and any saved draft can no longer be edited or published.`
                  : confirmation.kind === 'availability'
                    ? confirmation.availability === 'enabled'
                      ? `Enabling “${confirmation.project.slug}” immediately makes its eligible published revision available to the public.`
                      : `Disabling “${confirmation.project.slug}” immediately hides it from public listings and project details without changing its published revision.`
                    : `Revision #${confirmation.revision.id} will be copied into a new draft for “${confirmation.slug}”. It will not be published automatically.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
          title={
            confirmation.kind === 'publish'
              ? 'Publish project draft?'
              : confirmation.kind === 'discard'
                ? 'Discard project draft?'
                : confirmation.kind === 'archive'
                  ? 'Archive project permanently?'
                  : confirmation.kind === 'availability'
                    ? confirmation.availability === 'enabled'
                      ? 'Enable project?'
                      : 'Disable project?'
                    : 'Restore archived revision?'
          }
        />
      )}
    </section>
  )
}
