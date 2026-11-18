import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { RevisionStatusBadge } from '../cms/RevisionStatusBadge'
import { listAttachments } from '../cms/mediaApi'
import type { MediaAttachment, RevisionStatus } from '../cms/types'
import { ServiceCategoriesPanel } from './ServiceCategoriesPanel'
import {
  archiveService,
  createService,
  createServiceDraft,
  discardServiceDraft,
  getServiceDraft,
  listServiceCategories,
  listServiceRevisions,
  listServices,
  previewServiceDraft,
  publishServiceDraft,
  restoreServiceRevision,
  updateServiceDraft,
  type ServiceCategory,
  type ServiceFields,
  type ServiceManagementRecord,
  type ServiceRevision,
} from './managementApi'
import { ServiceEditor, type ServiceFormValues } from './ServiceEditor'

type StatusFilter = 'all' | 'draft' | 'published' | 'archived'

type Confirmation =
  | { kind: 'publish'; slug: string }
  | { kind: 'discard'; slug: string }
  | { kind: 'archive'; service: ServiceManagementRecord }
  | { kind: 'restore'; slug: string; revision: ServiceRevision }

interface EditorState {
  slug: string
  revision: ServiceRevision | null
}

const EMPTY_FIELDS: ServiceFields = {
  title: '',
  summary: '',
  description: '',
  category: null,
  display_order: 0,
  is_enabled: true,
  is_featured: false,
  features: [],
  benefits: [],
  process: '',
  cta_label: '',
  cta_destination: '',
  seo_title: '',
  seo_description: '',
}

function messageFor(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The service request could not be completed. Please try again.'
}

function fieldsFromRevision(revision: ServiceRevision): ServiceFormValues {
  return {
    slug: revision.slug,
    title: revision.title,
    summary: revision.summary,
    description: revision.description,
    category: revision.category,
    display_order: revision.display_order,
    is_enabled: revision.is_enabled,
    is_featured: revision.is_featured,
    features: revision.features,
    benefits: revision.benefits,
    process: revision.process,
    cta_label: revision.cta_label,
    cta_destination: revision.cta_destination,
    seo_title: revision.seo_title,
    seo_description: revision.seo_description,
  }
}

function fieldsFromForm(form: ServiceFormValues): ServiceFields {
  const { slug: _slug, ...fields } = form
  return fields
}

function displayDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function serviceStatus(service: ServiceManagementRecord): RevisionStatus {
  if (service.is_archived) {
    return 'archived'
  }
  if (service.draft) {
    return 'draft'
  }
  return service.published ? 'published' : 'draft'
}

function categoryName(
  categories: ServiceCategory[],
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

function ServiceDetails({
  revision,
  categories,
}: {
  revision: ServiceRevision
  categories: ServiceCategory[]
}) {
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
      {revision.features.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Features</h4>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
            {revision.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </div>
      )}
      {revision.benefits.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold">Benefits</h4>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
            {revision.benefits.map((benefit) => (
              <li key={benefit}>{benefit}</li>
            ))}
          </ul>
        </div>
      )}
      {revision.process && (
        <div className="sm:col-span-2">
          <h4 className="text-sm font-semibold">Process</h4>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
            {revision.process}
          </p>
        </div>
      )}
      <dl className="grid gap-2 text-sm sm:col-span-2 sm:grid-cols-2">
        <div>
          <dt className="font-semibold">Display order</dt>
          <dd className="text-slate-600">{revision.display_order}</dd>
        </div>
        <div>
          <dt className="font-semibold">Published visibility</dt>
          <dd className="text-slate-600">
            {revision.is_enabled ? 'Enabled' : 'Disabled'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Featured</dt>
          <dd className="text-slate-600">
            {revision.is_featured ? 'Yes' : 'No'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">Last saved</dt>
          <dd className="text-slate-600">{displayDate(revision.updated_at)}</dd>
        </div>
      </dl>
      {revision.cta_label && (
        <div className="sm:col-span-2">
          <h4 className="text-sm font-semibold">Call to action</h4>
          <p className="mt-1 text-sm text-slate-600">
            {revision.cta_label} → {revision.cta_destination}
          </p>
        </div>
      )}
    </div>
  )
}

export function ServicesManagementPage() {
  const [services, setServices] = useState<ServiceManagementRecord[]>([])
  const [categories, setCategories] = useState<ServiceCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [loadError, setLoadError] = useState('')
  const [categoryError, setCategoryError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [opening, setOpening] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [form, setForm] = useState<ServiceFormValues | null>(null)
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [preview, setPreview] = useState<ServiceRevision | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [historySlug, setHistorySlug] = useState<string | null>(null)
  const [history, setHistory] = useState<ServiceRevision[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  const dirty = useMemo(
    () =>
      Boolean(
        editor?.revision &&
          form &&
          JSON.stringify(fieldsFromRevision(editor.revision)) !==
            JSON.stringify(form),
      ),
    [editor, form],
  )

  async function refreshServices() {
    setLoadError('')
    try {
      setServices(await listServices())
    } catch (requestError) {
      setLoadError(messageFor(requestError))
    }
  }

  async function refreshCategories() {
    setCategoryError('')
    try {
      setCategories(await listServiceCategories())
    } catch (requestError) {
      setCategoryError(messageFor(requestError))
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setLoadError('')
      setCategoryError('')
      const [serviceResult, categoryResult] = await Promise.allSettled([
        listServices(),
        listServiceCategories(),
      ])
      if (!active) {
        return
      }
      if (serviceResult.status === 'fulfilled') {
        setServices(serviceResult.value)
      } else {
        setLoadError(messageFor(serviceResult.reason))
      }
      if (categoryResult.status === 'fulfilled') {
        setCategories(categoryResult.value)
      } else {
        setCategoryError(messageFor(categoryResult.reason))
      }
      setLoading(false)
    }
    void load()
    return () => {
      active = false
    }
  }, [loadAttempt])

  async function loadAttachments(revisionId: number) {
    setAttachmentError('')
    try {
      setAttachments(await listAttachments('service_revision', revisionId))
    } catch (requestError) {
      setAttachmentError(messageFor(requestError))
    }
  }

  function startNewService() {
    setEditor({ slug: '', revision: null })
    setForm({ slug: '', ...EMPTY_FIELDS })
    setAttachments([])
    setAttachmentError('')
    setActionError('')
    setNotice('')
    setPreview(null)
  }

  async function openServiceEditor(service: ServiceManagementRecord) {
    if (service.is_archived) {
      setActionError('Archived services cannot be edited or published.')
      return
    }
    setOpening(service.slug)
    setActionError('')
    setNotice('')
    try {
      let draft: ServiceRevision
      if (service.draft) {
        draft = await getServiceDraft(service.slug)
      } else {
        try {
          draft = await createServiceDraft(service.slug)
        } catch (createError) {
          if (
            !(createError instanceof SessionApiError) ||
            createError.status !== 409
          ) {
            throw createError
          }
          draft = await getServiceDraft(service.slug)
        }
      }
      setEditor({ slug: service.slug, revision: draft })
      setForm(fieldsFromRevision(draft))
      setAttachments([])
      setPreview(null)
      await Promise.all([loadAttachments(draft.id), refreshServices()])
    } catch (requestError) {
      setActionError(messageFor(requestError))
    } finally {
      setOpening(null)
    }
  }

  function changeField<Key extends keyof ServiceFormValues>(
    key: Key,
    value: ServiceFormValues[Key],
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
        const created = await createService({
          ...fieldsFromForm(form),
          slug: form.slug.trim(),
        })
        setEditor({ slug: created.slug, revision: created })
        setForm(fieldsFromRevision(created))
        setNotice('Service draft created.')
        await Promise.all([
          loadAttachments(created.id),
          refreshServices(),
        ])
      } else {
        const updated = await updateServiceDraft(
          editor.slug,
          fieldsFromForm(form),
        )
        setEditor({ ...editor, revision: updated })
        setForm(fieldsFromRevision(updated))
        setNotice('Service draft saved.')
        await refreshServices()
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
      setPreview(await previewServiceDraft(editor.slug))
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
      setHistory(await listServiceRevisions(slug))
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
    const affectedSlug =
      confirmation.kind === 'archive'
        ? confirmation.service.slug
        : confirmation.slug
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      if (confirmation.kind === 'publish') {
        await publishServiceDraft(confirmation.slug)
        setNotice(`Service “${confirmation.slug}” published.`)
        setEditor(null)
        setForm(null)
        setAttachments([])
      } else if (confirmation.kind === 'discard') {
        await discardServiceDraft(confirmation.slug)
        setNotice(`Draft for “${confirmation.slug}” discarded.`)
        setEditor(null)
        setForm(null)
        setAttachments([])
      } else if (confirmation.kind === 'archive') {
        await archiveService(confirmation.service.slug)
        setNotice(`Service “${confirmation.service.slug}” archived.`)
        setEditor(null)
        setForm(null)
        setAttachments([])
      } else {
        const restored = await restoreServiceRevision(
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
      await refreshServices()
      if (historySlug === affectedSlug) {
        setHistory(await listServiceRevisions(affectedSlug))
      }
    } catch (requestError) {
      setActionError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  const filteredServices = services.filter((service) => {
    const revision = service.draft ?? service.published
    const query = search.trim().toLowerCase()
    const matchesSearch =
      !query ||
      service.slug.toLowerCase().includes(query) ||
      revision?.title.toLowerCase().includes(query) ||
      revision?.summary.toLowerCase().includes(query)
    const matchesCategory =
      categoryFilter === 'all' ||
      String(revision?.category ?? '') === categoryFilter
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'archived' && service.is_archived) ||
      (statusFilter === 'draft' &&
        !service.is_archived &&
        Boolean(service.draft)) ||
      (statusFilter === 'published' &&
        !service.is_archived &&
        Boolean(service.published))
    return matchesSearch && matchesCategory && matchesStatus
  })

  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Loading services…
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
            Services Management
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Create and edit service drafts, manage categories and media, and
            publish changes only after review.
          </p>
        </div>
        <button
          className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
          disabled={busy || Boolean(opening)}
          onClick={startNewService}
          type="button"
        >
          Create service
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
        <ServiceEditor
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
              setActionError('Save or discard local changes before closing the editor.')
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
        />
      )}

      <section
        aria-labelledby="services-list-heading"
        className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" id="services-list-heading">
              Services
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {filteredServices.length} of {services.length} service
              {services.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="grid w-full gap-3 sm:w-auto sm:grid-cols-3">
            <label className="text-xs font-semibold text-slate-600">
              Search
              <input
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-brand-navy"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Title, summary, or slug"
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
                <option value="archived">Archived services</option>
              </select>
            </label>
          </div>
        </div>

        {services.length === 0 && !loadError ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
            <h3 className="font-semibold text-brand-navy">No services yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Create a service draft to start managing the catalogue.
            </p>
            <button
              className="mt-4 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue"
              onClick={startNewService}
              type="button"
            >
              Create service
            </button>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="mt-6 rounded-xl bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-600">
              No services match these filters.
            </p>
            <button
              className="mt-3 text-sm font-semibold text-brand-blue underline underline-offset-2"
              onClick={() => {
                setSearch('')
                setCategoryFilter('all')
                setStatusFilter('all')
              }}
              type="button"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-slate-200">
            {filteredServices.map((service) => {
              const status = serviceStatus(service)
              const current = service.draft ?? service.published
              return (
                <li className="py-5" key={service.id}>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-brand-navy">
                          {current?.title || service.slug}
                        </h3>
                        <RevisionStatusBadge status={status} />
                        {service.published && service.draft && (
                          <span className="text-xs text-slate-500">
                            Live version remains unchanged
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        /{service.slug}
                        {current
                          ? ` · ${categoryName(categories, current.category)}`
                          : ''}
                      </p>
                      <p className="mt-2 max-w-3xl text-sm text-slate-600">
                        {current?.summary || 'No summary saved.'}
                      </p>
                      {service.published && service.draft && (
                        <p className="mt-2 text-xs text-slate-500">
                          Currently live: {service.published.title || service.slug}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                        disabled={Boolean(opening) || busy || service.is_archived}
                        onClick={() => void openServiceEditor(service)}
                        type="button"
                      >
                        {opening === service.slug
                          ? 'Opening…'
                          : service.draft
                            ? 'Edit draft'
                            : service.is_archived
                              ? 'Archived'
                              : service.published
                                ? 'Edit as draft'
                                : 'Edit'}
                      </button>
                      {service.published && !service.is_archived && (
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                          disabled={busy}
                          onClick={() =>
                            setConfirmation({ kind: 'archive', service })
                          }
                          type="button"
                        >
                          Archive
                        </button>
                      )}
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                        disabled={historyLoading}
                        onClick={() => void showHistory(service.slug)}
                        type="button"
                      >
                        {historySlug === service.slug
                          ? 'Hide history'
                          : 'Revision history'}
                      </button>
                    </div>
                  </div>

                  {current && (
                    <details className="mt-4 rounded-lg bg-slate-50 px-4 py-3">
                      <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                        View service details
                      </summary>
                      {service.is_archived && (
                        <p className="mt-3 text-sm text-amber-900">
                          This service identity is archived and is not public.
                          The backend does not provide an unarchive operation.
                        </p>
                      )}
                      <ServiceDetails
                        categories={categories}
                        revision={current}
                      />
                    </details>
                  )}

                  {historySlug === service.slug && (
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
                                  Revision #{revision.id}
                                </span>
                                <RevisionStatusBadge status={revision.status} />
                                <span className="text-xs text-slate-500">
                                  Updated {displayDate(revision.updated_at)}
                                </span>
                              </div>
                              {revision.status === 'archived' && (
                                <button
                                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                                  disabled={
                                    busy ||
                                    Boolean(service.draft) ||
                                    service.is_archived
                                  }
                                  onClick={() =>
                                    setConfirmation({
                                      kind: 'restore',
                                      slug: service.slug,
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

      <ServiceCategoriesPanel
        categories={categories}
        onCategoriesChanged={refreshCategories}
      />

      {confirmation && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            confirmation.kind === 'publish'
              ? 'Publish service'
              : confirmation.kind === 'discard'
                ? 'Discard draft'
                : confirmation.kind === 'archive'
                  ? 'Archive service'
                  : 'Restore as draft'
          }
          description={
            confirmation.kind === 'publish'
              ? `Publishing “${confirmation.slug}” makes the saved draft live and archives the previous published revision.`
              : confirmation.kind === 'discard'
                ? `This deletes the saved draft for “${confirmation.slug}”. Any previously published revision remains live.`
                : confirmation.kind === 'archive'
                  ? `Archiving “${confirmation.service.slug}” immediately removes it from the public catalogue. The backend has no unarchive endpoint, and any draft on this service can no longer be published.`
                  : `Revision #${confirmation.revision.id} will be copied into a new draft for “${confirmation.slug}”. It will not be published automatically.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
          title={
            confirmation.kind === 'publish'
              ? 'Publish service draft?'
              : confirmation.kind === 'discard'
                ? 'Discard service draft?'
                : confirmation.kind === 'archive'
                  ? 'Archive service permanently?'
                  : 'Restore archived revision?'
          }
        />
      )}
    </section>
  )
}
