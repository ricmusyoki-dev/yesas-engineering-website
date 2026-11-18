import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { ContentPreviewDialog } from '../cms/ContentPreviewDialog'
import { MediaAttachmentsManager } from '../cms/MediaAttachmentsManager'
import { RevisionStatusBadge } from '../cms/RevisionStatusBadge'
import { listAttachments } from '../cms/mediaApi'
import type {
  FeaturedOption,
  HomepageSectionFields,
  HomepageSectionRevision,
  MediaAttachment,
} from '../cms/types'
import {
  createHomepageSectionDraft,
  getHomepageSectionDraft,
  HOMEPAGE_SECTION_TYPES,
  listFeaturedProjects,
  listFeaturedServices,
  listHomepageRevisions,
  listHomepageSections,
  previewHomepage,
  publishHomepageSectionDraft,
  restoreHomepageRevision,
  updateHomepageSectionDraft,
} from './managementApi'

type SectionType = HomepageSectionFields['section_type']

const SECTION_LABELS: Record<SectionType, string> = {
  HERO: 'Hero',
  INTRODUCTION: 'Introduction',
  FEATURED_SERVICES: 'Featured services',
  FEATURED_PROJECTS: 'Featured projects',
  CONTACT_CTA: 'Contact call to action',
}

const labelClass = 'block text-sm font-medium text-slate-700'
const fieldClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-brand-navy'

function getErrorMessage(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The homepage request could not be completed. Please try again.'
}

function fieldsFromRevision(
  revision: HomepageSectionRevision,
): HomepageSectionFields {
  return {
    section_type: revision.section_type,
    heading: revision.heading,
    body: revision.body,
    cta_label: revision.cta_label,
    cta_destination: revision.cta_destination,
    is_visible: revision.is_visible,
    display_order: revision.display_order,
    item_limit: revision.item_limit,
    curated_services: revision.curated_services,
    curated_projects: revision.curated_projects,
  }
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function isFeaturedService(type: SectionType): boolean {
  return type === 'FEATURED_SERVICES'
}

function isFeaturedProject(type: SectionType): boolean {
  return type === 'FEATURED_PROJECTS'
}

function supportsCta(type: SectionType): boolean {
  return type === 'HERO' || type === 'CONTACT_CTA'
}

export function HomepagePage() {
  const [sections, setSections] = useState<HomepageSectionRevision[]>([])
  const [history, setHistory] = useState<HomepageSectionRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [editor, setEditor] = useState<HomepageSectionRevision | null>(null)
  const [form, setForm] = useState<HomepageSectionFields | null>(null)
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState('')
  const [featuredOptions, setFeaturedOptions] = useState<FeaturedOption[]>([])
  const [optionsError, setOptionsError] = useState('')
  const [confirmation, setConfirmation] = useState<
    | { kind: 'publish'; sectionType: SectionType }
    | { kind: 'restore'; revision: HomepageSectionRevision }
    | null
  >(null)
  const [preview, setPreview] = useState<HomepageSectionRevision | null>(null)
  const [previewAttachments, setPreviewAttachments] = useState<
    MediaAttachment[]
  >([])
  const [busySection, setBusySection] = useState<SectionType | null>(null)

  const dirty = useMemo(
    () =>
      Boolean(
        editor &&
          form &&
          JSON.stringify(fieldsFromRevision(editor)) !== JSON.stringify(form),
      ),
    [editor, form],
  )

  async function refreshSections() {
    setLoadError('')
    try {
      setSections(await listHomepageSections())
    } catch (requestError) {
      setLoadError(getErrorMessage(requestError))
    }
  }

  async function refreshHistory() {
    setHistoryError('')
    try {
      setHistory(await listHomepageRevisions())
    } catch (requestError) {
      setHistoryError(getErrorMessage(requestError))
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      await Promise.all([refreshSections(), refreshHistory()])
      if (active) {
        setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [loadAttempt])

  async function loadEditorAttachments(revisionId: number) {
    setAttachmentError('')
    try {
      setAttachments(
        await listAttachments('homepage_section_revision', revisionId),
      )
    } catch (requestError) {
      setAttachmentError(getErrorMessage(requestError))
    }
  }

  async function loadFeaturedOptions(sectionType: SectionType) {
    setFeaturedOptions([])
    setOptionsError('')
    if (isFeaturedService(sectionType)) {
      try {
        setFeaturedOptions(await listFeaturedServices())
      } catch (requestError) {
        setOptionsError(getErrorMessage(requestError))
      }
    } else if (isFeaturedProject(sectionType)) {
      try {
        setFeaturedOptions(await listFeaturedProjects())
      } catch (requestError) {
        setOptionsError(getErrorMessage(requestError))
      }
    }
  }

  function setEditingRevision(revision: HomepageSectionRevision) {
    setEditor(revision)
    setForm(fieldsFromRevision(revision))
    setNotice('')
  }

  async function openEditor(sectionType: SectionType) {
    setBusySection(sectionType)
    setActionError('')
    setNotice('')
    try {
      const current = sections.find(
        (section) => section.section_type === sectionType,
      )
      let draft: HomepageSectionRevision
      if (current?.status === 'draft') {
        draft = await getHomepageSectionDraft(sectionType)
      } else {
        try {
          draft = await createHomepageSectionDraft(sectionType)
        } catch (createError) {
          if (
            !(createError instanceof SessionApiError) ||
            createError.status !== 409
          ) {
            throw createError
          }
          draft = await getHomepageSectionDraft(sectionType)
        }
      }
      setEditingRevision(draft)
      setAttachments([])
      await Promise.all([
        loadEditorAttachments(draft.id),
        loadFeaturedOptions(sectionType),
      ])
      await Promise.all([refreshSections(), refreshHistory()])
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setBusySection(null)
    }
  }

  function updateField<Key extends keyof HomepageSectionFields>(
    key: Key,
    value: HomepageSectionFields[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor || !form || editor.status !== 'draft') {
      return
    }
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      const updated = await updateHomepageSectionDraft(
        editor.section_type,
        form,
      )
      setEditingRevision(updated)
      setNotice(`${SECTION_LABELS[updated.section_type]} draft saved.`)
      await Promise.all([refreshSections(), refreshHistory()])
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function openPreview(sectionType: SectionType) {
    setActionError('')
    try {
      const activeSections = await previewHomepage()
      const section = activeSections.find(
        (item) => item.section_type === sectionType,
      )
      if (!section) {
        throw new SessionApiError(
          'This homepage section does not have a previewable revision.',
          'http',
          404,
        )
      }
      const media =
        section.status === 'draft'
          ? await listAttachments('homepage_section_revision', section.id)
          : []
      setPreviewAttachments(media)
      setPreview(section)
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    }
  }

  async function confirmAction() {
    if (!confirmation) {
      return
    }
    setBusy(true)
    setActionError('')
    setNotice('')
    try {
      if (confirmation.kind === 'publish') {
        const published = await publishHomepageSectionDraft(
          confirmation.sectionType,
        )
        setNotice(`${SECTION_LABELS[published.section_type]} section published.`)
        setEditor(null)
        setForm(null)
      } else {
        const restored = await restoreHomepageRevision(
          confirmation.revision.id,
        )
        setEditingRevision(restored)
        setNotice(
          `${SECTION_LABELS[restored.section_type]} revision restored as a new draft.`,
        )
        await Promise.all([
          loadEditorAttachments(restored.id),
          loadFeaturedOptions(restored.section_type),
        ])
      }
      setConfirmation(null)
      await Promise.all([refreshSections(), refreshHistory()])
    } catch (requestError) {
      setActionError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publishDraft(sectionType: SectionType) {
    if (editor?.section_type === sectionType && dirty) {
      setActionError('Save draft changes before publishing.')
      return
    }
    setConfirmation({ kind: 'publish', sectionType })
  }

  const historyByType = new Map<SectionType, HomepageSectionRevision[]>()
  for (const revision of history) {
    const revisions = historyByType.get(revision.section_type) ?? []
    revisions.push(revision)
    historyByType.set(revision.section_type, revisions)
  }
  for (const revisions of historyByType.values()) {
    revisions.sort((a, b) => b.created_at.localeCompare(a.created_at))
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Loading homepage sections…
      </p>
    )
  }

  return (
    <section>
      <div className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
          Website management
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Homepage</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Prepare each supported section as a separate draft. Visibility and
          ordering changes take effect only when that section is explicitly
          published.
        </p>
      </div>

      {(loadError || actionError) && (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
          {loadError || actionError}
          {loadError && (
            <button
              className="ml-3 underline underline-offset-2"
              onClick={() => setLoadAttempt((attempt) => attempt + 1)}
              type="button"
            >
              Retry
            </button>
          )}
        </p>
      )}
      {notice && (
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      )}

      {!loadError && (
        <div className="mt-7 space-y-5">
          {HOMEPAGE_SECTION_TYPES.map((sectionType) => {
            const active = sections.find(
              (section) => section.section_type === sectionType,
            )
            const sectionHistory = historyByType.get(sectionType) ?? []
            const isDraft = active?.status === 'draft'
            const canRestore = !isDraft

            return (
              <article
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                key={sectionType}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-bold">
                        {SECTION_LABELS[sectionType]}
                      </h2>
                      {active ? (
                        <RevisionStatusBadge status={active.status} />
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          Not configured
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {active
                        ? active.heading || 'This revision has no heading yet.'
                        : 'Create the first draft for this section.'}
                    </p>
                    {active && (
                      <p className="mt-2 text-xs text-slate-500">
                        Revision #{active.id} · Order {active.display_order} ·{' '}
                        {active.is_visible ? 'Visible' : 'Hidden'} · Updated{' '}
                        {displayDate(active.updated_at)}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                      disabled={Boolean(busySection) || Boolean(busy)}
                      onClick={() => void openEditor(sectionType)}
                      type="button"
                    >
                      {busySection === sectionType
                        ? 'Opening…'
                        : isDraft
                          ? 'Continue draft'
                          : active
                            ? 'Edit as draft'
                            : 'Create draft'}
                    </button>
                    {active && (
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
                        onClick={() => void openPreview(sectionType)}
                        type="button"
                      >
                        Preview
                      </button>
                    )}
                    {isDraft && (
                      <button
                        className="rounded-lg bg-brand-orange px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                        disabled={busy || (editor?.section_type === sectionType && dirty)}
                        onClick={() => void publishDraft(sectionType)}
                        type="button"
                      >
                        Publish
                      </button>
                    )}
                  </div>
                </div>

                <details className="mt-5 border-t border-slate-100 pt-4">
                  <summary className="cursor-pointer text-sm font-semibold text-brand-blue">
                    Revision history ({sectionHistory.length})
                  </summary>
                  {sectionHistory.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">
                      No saved revisions.
                    </p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {sectionHistory.map((item) => (
                        <li
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
                          key={item.id}
                        >
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-sm font-semibold">
                              Revision #{item.id}
                            </span>
                            <RevisionStatusBadge status={item.status} />
                            <span className="text-xs text-slate-500">
                              Updated {displayDate(item.updated_at)}
                            </span>
                          </div>
                          {item.status === 'archived' && (
                            <button
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                              disabled={!canRestore || busy}
                              onClick={() =>
                                setConfirmation({ kind: 'restore', revision: item })
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
                </details>
              </article>
            )
          })}
        </div>
      )}

      {historyError && (
        <p className="mt-5 text-sm text-red-800" role="alert">
          Revision history could not be loaded: {historyError}
        </p>
      )}

      {editor && form && (
        <section
          aria-labelledby="homepage-editor-heading"
          className="mt-10 rounded-2xl border-2 border-brand-blue/20 bg-slate-50 p-5 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
                Draft editor · Revision #{editor.id}
              </p>
              <h2
                className="mt-1 text-2xl font-bold"
                id="homepage-editor-heading"
              >
                {SECTION_LABELS[editor.section_type]}
              </h2>
            </div>
            <button
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-white"
              disabled={busy}
              onClick={() => {
                setEditor(null)
                setForm(null)
                setAttachments([])
                setActionError('')
              }}
              type="button"
            >
              Close editor
            </button>
          </div>

          <form
            className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
            onSubmit={(event) => void saveDraft(event)}
          >
            <label className={`${labelClass} sm:col-span-2`}>
              Heading
              <input
                className={fieldClass}
                disabled={editor.status !== 'draft' || busy}
                maxLength={200}
                onChange={(event) => updateField('heading', event.target.value)}
                value={form.heading}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              Body
              <textarea
                className={fieldClass}
                disabled={editor.status !== 'draft' || busy}
                onChange={(event) => updateField('body', event.target.value)}
                rows={5}
                value={form.body}
              />
            </label>
            {supportsCta(editor.section_type) && (
              <>
                <label className={labelClass}>
                  Call-to-action label
                  <input
                    className={fieldClass}
                    disabled={editor.status !== 'draft' || busy}
                    maxLength={100}
                    onChange={(event) =>
                      updateField('cta_label', event.target.value)
                    }
                    value={form.cta_label}
                  />
                </label>
                <label className={labelClass}>
                  Call-to-action destination
                  <input
                    className={fieldClass}
                    disabled={editor.status !== 'draft' || busy}
                    maxLength={500}
                    onChange={(event) =>
                      updateField('cta_destination', event.target.value)
                    }
                    value={form.cta_destination}
                  />
                </label>
              </>
            )}
            <label className={labelClass}>
              Display order
              <input
                className={fieldClass}
                disabled={editor.status !== 'draft' || busy}
                max={32767}
                min={0}
                onChange={(event) =>
                  updateField('display_order', Number(event.target.value))
                }
                type="number"
                value={form.display_order}
              />
            </label>
            <label className="flex items-center gap-3 self-end rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
              <input
                checked={form.is_visible}
                disabled={editor.status !== 'draft' || busy}
                onChange={(event) =>
                  updateField('is_visible', event.target.checked)
                }
                type="checkbox"
              />
              Visible on the homepage when published
            </label>

            {(isFeaturedService(editor.section_type) ||
              isFeaturedProject(editor.section_type)) && (
              <>
                <label className={labelClass}>
                  Maximum featured items
                  <input
                    className={fieldClass}
                    disabled={editor.status !== 'draft' || busy}
                    max={32767}
                    min={1}
                    onChange={(event) =>
                      updateField(
                        'item_limit',
                        event.target.value === ''
                          ? null
                          : Number(event.target.value),
                      )
                    }
                    type="number"
                    value={form.item_limit ?? ''}
                  />
                </label>
                <fieldset className="sm:col-span-2" disabled={editor.status !== 'draft' || busy}>
                  <legend className="text-sm font-semibold text-brand-navy">
                    Select published content to feature
                  </legend>
                  {optionsError && (
                    <div className="mt-2 text-sm text-red-800" role="alert">
                      <p>{optionsError}</p>
                      <button
                        className="mt-1 underline underline-offset-2"
                        onClick={() =>
                          void loadFeaturedOptions(editor.section_type)
                        }
                        type="button"
                      >
                        Retry loading options
                      </button>
                    </div>
                  )}
                  {(() => {
                    const selected = isFeaturedService(editor.section_type)
                      ? form.curated_services
                      : form.curated_projects
                    const options: Array<
                      FeaturedOption & { unavailable?: boolean }
                    > = [
                      ...featuredOptions,
                      ...selected
                        .filter(
                          (id) =>
                            !featuredOptions.some((option) => option.id === id),
                        )
                        .map((id) => ({
                          id,
                          label: `Existing selection ${id}`,
                          unavailable: true,
                        })),
                    ]
                    if (options.length === 0) {
                      return (
                        <p className="mt-2 text-sm text-slate-600">
                          {optionsError
                            ? 'Available items could not be loaded.'
                            : `No published, enabled ${isFeaturedService(editor.section_type) ? 'services' : 'projects'} are available.`}
                        </p>
                      )
                    }
                    return (
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {options.map((option) => {
                        const selectedIds = isFeaturedService(editor.section_type)
                          ? form.curated_services
                          : form.curated_projects
                        const checked = selectedIds.includes(option.id)
                        return (
                          <li key={option.id}>
                            <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm text-slate-700">
                              <input
                                checked={checked}
                                onChange={() => {
                                  const updated = checked
                                    ? selectedIds.filter((id) => id !== option.id)
                                    : [...selectedIds, option.id]
                                  if (isFeaturedService(editor.section_type)) {
                                    updateField('curated_services', updated)
                                  } else {
                                    updateField('curated_projects', updated)
                                  }
                                }}
                                type="checkbox"
                              />
                              <span>
                                {option.label}
                                {option.unavailable && (
                                  <span className="ml-1 text-xs text-amber-800">
                                    (not currently available to feature)
                                  </span>
                                )}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                    )
                  })()}
                </fieldset>
              </>
            )}

            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button
                className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                disabled={busy || editor.status !== 'draft' || !dirty}
                type="submit"
              >
                {busy ? 'Saving…' : 'Save draft'}
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                disabled={busy || dirty}
                onClick={() => void openPreview(editor.section_type)}
                type="button"
              >
                Preview
              </button>
              <button
                className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                disabled={busy || editor.status !== 'draft' || dirty}
                onClick={() => void publishDraft(editor.section_type)}
                type="button"
              >
                Publish section
              </button>
              {dirty && (
                <p className="text-sm text-amber-800" role="status">
                  Save changes before previewing or publishing.
                </p>
              )}
            </div>
          </form>

          {attachmentError && (
            <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
              {attachmentError}
            </p>
          )}
          <MediaAttachmentsManager
            attachments={attachments}
            editable={editor.status === 'draft'}
            key={`${editor.id}-${editor.status}`}
            onAttachmentsChange={setAttachments}
            revisionId={editor.id}
            roles={
              editor.section_type === 'HERO'
                ? [
                    { value: 'hero_image', label: 'Hero image' },
                    { value: 'hero_video', label: 'Hero video' },
                    { value: 'section_image', label: 'Section image' },
                    { value: 'section_video', label: 'Section video' },
                  ]
                : [
                    { value: 'section_image', label: 'Section image' },
                    { value: 'section_video', label: 'Section video' },
                  ]
            }
            target="homepage_section_revision"
          />
        </section>
      )}

      {confirmation && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            confirmation.kind === 'publish' ? 'Publish section' : 'Restore draft'
          }
          description={
            confirmation.kind === 'publish'
              ? `Publishing ${SECTION_LABELS[confirmation.sectionType]} will update that live homepage section and archive its previous published revision.`
              : `Revision #${confirmation.revision.id} will be copied into a new draft. It will not be published automatically.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
          title={
            confirmation.kind === 'publish'
              ? 'Publish homepage section?'
              : 'Restore archived revision?'
          }
        />
      )}

      {preview && (
        <ContentPreviewDialog
          onClose={() => setPreview(null)}
          title={SECTION_LABELS[preview.section_type]}
        >
          <article>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {preview.is_visible ? 'Visible when published' : 'Hidden when published'}{' '}
              · Order {preview.display_order} · Revision #{preview.id}
            </p>
            <h3 className="mt-3 text-3xl font-bold text-brand-navy">
              {preview.heading}
            </h3>
            {preview.body && (
              <p className="mt-4 whitespace-pre-wrap text-slate-700">
                {preview.body}
              </p>
            )}
            {preview.cta_label && (
              <p className="mt-5 inline-flex rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white">
                {preview.cta_label}
              </p>
            )}
            {previewAttachments.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {previewAttachments.map((attachment) =>
                  attachment.asset.media_type === 'image' ? (
                    <img
                      alt={
                        attachment.alt_text_override ||
                        attachment.asset.alt_text ||
                        attachment.asset.title
                      }
                      className="aspect-video w-full rounded-lg object-cover"
                      key={attachment.id}
                      src={
                        attachment.asset.thumbnail_url ??
                        attachment.asset.content_url
                      }
                    />
                  ) : (
                    <video
                      aria-label={
                        attachment.asset.title ||
                        attachment.asset.display_filename
                      }
                      className="aspect-video w-full rounded-lg bg-slate-100 object-cover"
                      controls
                      key={attachment.id}
                      preload="metadata"
                      src={attachment.asset.content_url}
                    />
                  ),
                )}
              </div>
            )}
            {preview.status !== 'draft' && (
              <p className="mt-5 text-xs text-slate-500">
                Published media is not included in the management preview
                response.
              </p>
            )}
          </article>
        </ContentPreviewDialog>
      )}
    </section>
  )
}
