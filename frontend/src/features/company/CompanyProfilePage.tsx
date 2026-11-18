import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { ContentPreviewDialog } from '../cms/ContentPreviewDialog'
import { MediaAttachmentsManager } from '../cms/MediaAttachmentsManager'
import { RevisionStatusBadge } from '../cms/RevisionStatusBadge'
import { listAttachments } from '../cms/mediaApi'
import type {
  CompanyProfileFields,
  CompanyProfileRevision,
  MediaAttachment,
} from '../cms/types'
import {
  createCompanyProfileDraft,
  getCompanyProfileDraft,
  getCurrentCompanyProfile,
  listCompanyProfileRevisions,
  previewCompanyProfileDraft,
  publishCompanyProfileDraft,
  restoreCompanyProfileRevision,
  updateCompanyProfileDraft,
} from './managementApi'

function isNotFound(error: unknown): boolean {
  return error instanceof SessionApiError && error.status === 404
}

function getRequestError(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The company profile request could not be completed. Please try again.'
}

function fieldsFromRevision(
  revision: CompanyProfileRevision,
): CompanyProfileFields {
  return {
    name: revision.name,
    tagline: revision.tagline,
    description: revision.description,
    overview: revision.overview,
    business_phone: revision.business_phone,
    whatsapp_number: revision.whatsapp_number,
    business_email: revision.business_email,
    physical_address: revision.physical_address,
    city: revision.city,
    country: revision.country,
    service_areas: revision.service_areas,
    linkedin_url: revision.linkedin_url,
    instagram_url: revision.instagram_url,
    facebook_url: revision.facebook_url,
    tiktok_url: revision.tiktok_url,
    youtube_url: revision.youtube_url,
  }
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

const fieldClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-brand-navy'
const labelClass = 'block text-sm font-medium text-slate-700'

export function CompanyProfilePage() {
  const [revision, setRevision] = useState<CompanyProfileRevision | null>(null)
  const [form, setForm] = useState<CompanyProfileFields | null>(null)
  const [attachments, setAttachments] = useState<MediaAttachment[]>([])
  const [history, setHistory] = useState<CompanyProfileRevision[]>([])
  const [loading, setLoading] = useState(true)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [attachmentError, setAttachmentError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmation, setConfirmation] = useState<
    | { kind: 'publish' }
    | { kind: 'restore'; revision: CompanyProfileRevision }
    | null
  >(null)
  const [preview, setPreview] = useState<CompanyProfileRevision | null>(null)

  const dirty = useMemo(
    () =>
      Boolean(
        revision &&
          form &&
          JSON.stringify(fieldsFromRevision(revision)) !== JSON.stringify(form),
      ),
    [form, revision],
  )

  async function refreshHistory() {
    setHistoryError('')
    try {
      setHistory(await listCompanyProfileRevisions())
    } catch (requestError) {
      setHistoryError(requestErrorMessage(requestError))
    }
  }

  function requestErrorMessage(requestError: unknown): string {
    return requestError instanceof SessionApiError
      ? requestError.message
      : 'Revision history could not be loaded.'
  }

  async function loadAttachments(revisionId: number) {
    setAttachmentError('')
    try {
      setAttachments(await listAttachments('company_profile_revision', revisionId))
    } catch (requestError) {
      setAttachmentError(requestErrorMessage(requestError))
    }
  }

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError('')
      try {
        const current = await getCurrentCompanyProfile()
        if (!active) {
          return
        }
        setRevision(current)
        setForm(fieldsFromRevision(current))
        if (current.status === 'draft') {
          await loadAttachments(current.id)
        }
      } catch (loadError) {
        if (!active) {
          return
        }
        if (!isNotFound(loadError)) {
          setError(getRequestError(loadError))
        } else {
          setRevision(null)
          setForm(null)
          setAttachments([])
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
      if (active) {
        await refreshHistory()
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [loadAttempt])

  function setField<Key extends keyof CompanyProfileFields>(
    key: Key,
    value: CompanyProfileFields[Key],
  ) {
    setForm((current) => (current ? { ...current, [key]: value } : current))
  }

  function applyRevision(updated: CompanyProfileRevision) {
    setRevision(updated)
    setForm(fieldsFromRevision(updated))
    setNotice('')
  }

  async function startDraft() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let draft: CompanyProfileRevision
      try {
        draft = await createCompanyProfileDraft()
      } catch (createError) {
        if (!(createError instanceof SessionApiError) || createError.status !== 409) {
          throw createError
        }
        draft = await getCompanyProfileDraft()
      }
      applyRevision(draft)
      await loadAttachments(draft.id)
      await refreshHistory()
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form || revision?.status !== 'draft') {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateCompanyProfileDraft(form)
      applyRevision(updated)
      setNotice('Company profile draft saved.')
      await refreshHistory()
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmAction() {
    if (!confirmation) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (confirmation.kind === 'publish') {
        const published = await publishCompanyProfileDraft()
        applyRevision(published)
        setNotice('Company profile published.')
      } else {
        const restored = await restoreCompanyProfileRevision(
          confirmation.revision.id,
        )
        applyRevision(restored)
        await loadAttachments(restored.id)
        setNotice('Archived revision restored as a new draft.')
      }
      setConfirmation(null)
      await refreshHistory()
    } catch (requestError) {
      setError(getRequestError(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function openPreview() {
    if (dirty) {
      return
    }
    setError('')
    try {
      setPreview(await previewCompanyProfileDraft())
    } catch (requestError) {
      setError(getRequestError(requestError))
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-slate-600" role="status">
        Loading company profile…
      </p>
    )
  }

  if (error && !revision && !form) {
    return (
      <section>
        <h1 className="text-3xl font-bold">Company Profile</h1>
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </p>
        <button
          className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
          onClick={() => setLoadAttempt((attempt) => attempt + 1)}
          type="button"
        >
          Retry
        </button>
      </section>
    )
  }

  const isDraft = revision?.status === 'draft'
  const sortedHistory = [...history].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  )

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Website management
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Company Profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Edit company information in a draft. The live profile changes only
            after an explicit publish action.
          </p>
        </div>
        {revision && (
          <div className="flex items-center gap-3">
            <RevisionStatusBadge status={revision.status} />
            <span className="text-xs text-slate-500">
              Revision #{revision.id}
            </span>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      )}

      {!revision && (
        <div className="mt-7 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-bold">No company profile exists yet</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create an initial draft using the backend’s configured profile
            defaults, then review and publish it when ready.
          </p>
          <button
            className="mt-5 rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
            disabled={busy}
            onClick={() => void startDraft()}
            type="button"
          >
            {busy ? 'Creating draft…' : 'Create initial draft'}
          </button>
        </div>
      )}

      {revision && form && (
        <>
          {!isDraft && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm text-emerald-950">
                This is the live published profile. Create a separate draft to
                make changes without altering it.
              </p>
              <button
                className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                disabled={busy}
                onClick={() => void startDraft()}
                type="button"
              >
                {busy ? 'Creating draft…' : 'Edit as draft'}
              </button>
            </div>
          )}

          <form
            className="mt-7 space-y-8"
            onSubmit={(event) => void saveDraft(event)}
          >
            <fieldset
              className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
              disabled={!isDraft || busy}
            >
              <legend className="px-2 text-lg font-bold">Company details</legend>
              <label className={labelClass}>
                Company name
                <input
                  className={fieldClass}
                  maxLength={200}
                  onChange={(event) => setField('name', event.target.value)}
                  required
                  value={form.name}
                />
              </label>
              <label className={labelClass}>
                Tagline
                <input
                  className={fieldClass}
                  maxLength={255}
                  onChange={(event) => setField('tagline', event.target.value)}
                  value={form.tagline}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Short description
                <textarea
                  className={fieldClass}
                  onChange={(event) => setField('description', event.target.value)}
                  rows={3}
                  value={form.description}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Company overview
                <textarea
                  className={fieldClass}
                  onChange={(event) => setField('overview', event.target.value)}
                  rows={5}
                  value={form.overview}
                />
              </label>
              <label className={labelClass}>
                Business phone
                <input
                  className={fieldClass}
                  onChange={(event) =>
                    setField('business_phone', event.target.value)
                  }
                  type="tel"
                  value={form.business_phone}
                />
              </label>
              <label className={labelClass}>
                WhatsApp number
                <input
                  className={fieldClass}
                  onChange={(event) =>
                    setField('whatsapp_number', event.target.value)
                  }
                  type="tel"
                  value={form.whatsapp_number}
                />
              </label>
              <label className={labelClass}>
                Business email
                <input
                  className={fieldClass}
                  onChange={(event) =>
                    setField('business_email', event.target.value)
                  }
                  type="email"
                  value={form.business_email}
                />
              </label>
              <label className={labelClass}>
                Physical address
                <textarea
                  className={fieldClass}
                  onChange={(event) =>
                    setField('physical_address', event.target.value)
                  }
                  rows={2}
                  value={form.physical_address}
                />
              </label>
              <label className={labelClass}>
                City
                <input
                  className={fieldClass}
                  onChange={(event) => setField('city', event.target.value)}
                  value={form.city}
                />
              </label>
              <label className={labelClass}>
                Country
                <input
                  className={fieldClass}
                  onChange={(event) => setField('country', event.target.value)}
                  value={form.country}
                />
              </label>
              <label className={`${labelClass} sm:col-span-2`}>
                Service areas
                <textarea
                  className={fieldClass}
                  onChange={(event) =>
                    setField(
                      'service_areas',
                      event.target.value
                        .split('\n')
                        .map((area) => area.trim())
                        .filter(Boolean),
                    )
                  }
                  placeholder="One service area per line"
                  rows={3}
                  value={form.service_areas.join('\n')}
                />
              </label>
            </fieldset>

            <fieldset
              className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
              disabled={!isDraft || busy}
            >
              <legend className="px-2 text-lg font-bold">Social links</legend>
              {(
                [
                  ['linkedin_url', 'LinkedIn URL'],
                  ['instagram_url', 'Instagram URL'],
                  ['facebook_url', 'Facebook URL'],
                  ['tiktok_url', 'TikTok URL'],
                  ['youtube_url', 'YouTube URL'],
                ] as const
              ).map(([key, label]) => (
                <label className={labelClass} key={key}>
                  {label}
                  <input
                    className={fieldClass}
                    onChange={(event) => setField(key, event.target.value)}
                    type="url"
                    value={form[key]}
                  />
                </label>
              ))}
            </fieldset>

            {isDraft && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                  disabled={busy || !dirty}
                  type="submit"
                >
                  {busy ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                  disabled={busy || dirty}
                  onClick={() => void openPreview()}
                  type="button"
                >
                  Preview draft
                </button>
                <button
                  className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
                  disabled={busy || dirty}
                  onClick={() => setConfirmation({ kind: 'publish' })}
                  type="button"
                >
                  Publish
                </button>
                {dirty && (
                  <p className="text-sm text-amber-800" role="status">
                    Save changes before previewing or publishing.
                  </p>
                )}
              </div>
            )}

            {revision && (
              <p className="text-xs text-slate-500">
                Last updated {displayDate(revision.updated_at)}
              </p>
            )}
          </form>

          {revision && (
            <>
              {attachmentError && (
                <p className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800" role="alert">
                  {attachmentError}
                </p>
              )}
              <MediaAttachmentsManager
                attachments={attachments}
                editable={isDraft}
                key={`${revision.id}-${revision.status}`}
                onAttachmentsChange={setAttachments}
                revisionId={revision.id}
                roles={[
                  { value: 'logo', label: 'Company logo' },
                  { value: 'section_image', label: 'Profile image' },
                ]}
                target="company_profile_revision"
              />
            </>
          )}
        </>
      )}

      <section
        aria-labelledby="company-revisions-heading"
        className="mt-10 rounded-xl border border-slate-200 bg-white p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold" id="company-revisions-heading">
              Revision history
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Restoring an archived version creates a new draft; it does not
              replace the live profile.
            </p>
          </div>
        </div>
        {historyError && (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {historyError}
          </p>
        )}
        {sortedHistory.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">No revisions are available.</p>
        ) : (
          <ul className="mt-5 divide-y divide-slate-200">
            {sortedHistory.map((item) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 py-4"
                key={item.id}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold">
                    Revision #{item.id}
                  </span>
                  <RevisionStatusBadge status={item.status} />
                  <span className="text-sm text-slate-500">
                    Updated {displayDate(item.updated_at)}
                  </span>
                </div>
                {item.status === 'archived' && (
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                    disabled={busy || isDraft}
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
      </section>

      {confirmation && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            confirmation.kind === 'publish' ? 'Publish profile' : 'Restore draft'
          }
          description={
            confirmation.kind === 'publish'
              ? 'This will make the saved draft live and archive the previous published profile. This action cannot be undone.'
              : `Revision #${confirmation.revision.id} will be copied into a new draft. The current published profile will remain unchanged.`
          }
          onCancel={() => setConfirmation(null)}
          onConfirm={() => void confirmAction()}
          title={
            confirmation.kind === 'publish'
              ? 'Publish company profile?'
              : 'Restore archived revision?'
          }
        />
      )}

      {preview && (
        <ContentPreviewDialog
          onClose={() => setPreview(null)}
          title={preview.name || 'Company profile'}
        >
          <div className="space-y-5">
            <div>
              <h3 className="text-3xl font-bold text-brand-navy">
                {preview.name}
              </h3>
              {preview.tagline && (
                <p className="mt-2 text-lg text-brand-blue">{preview.tagline}</p>
              )}
              {preview.description && (
                <p className="mt-4 leading-7 text-slate-700">
                  {preview.description}
                </p>
              )}
            </div>
            {preview.overview && (
              <section>
                <h3 className="font-bold">Overview</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {preview.overview}
                </p>
              </section>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ['Phone', preview.business_phone],
                ['WhatsApp', preview.whatsapp_number],
                ['Email', preview.business_email],
                [
                  'Location',
                  [preview.physical_address, preview.city, preview.country]
                    .filter(Boolean)
                    .join(', '),
                ],
              ]
                .filter(([, value]) => value)
                .map(([label, value]) => (
                  <div key={label}>
                    <dt className="font-semibold">{label}</dt>
                    <dd className="mt-1 text-slate-600">{value}</dd>
                  </div>
                ))}
            </dl>
            {preview.service_areas.length > 0 && (
              <p className="text-sm text-slate-600">
                Service areas: {preview.service_areas.join(', ')}
              </p>
            )}
            {attachments.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-3">
                {attachments.map((attachment) =>
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
                  ) : null,
                )}
              </div>
            )}
          </div>
        </ContentPreviewDialog>
      )}
    </section>
  )
}
