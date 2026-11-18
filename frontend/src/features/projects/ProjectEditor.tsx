import { MediaAttachmentsManager } from '../cms/MediaAttachmentsManager'
import { ContentPreviewDialog } from '../cms/ContentPreviewDialog'
import type { FormEvent } from 'react'
import type { ManagementService, MediaAttachment } from '../cms/types'
import type {
  ProjectCategory,
  ProjectFields,
  ProjectRevision,
  ProjectTag,
} from './managementApi'

export interface ProjectFormValues extends ProjectFields {
  slug: string
}

interface ProjectEditorProps {
  form: ProjectFormValues
  revision: ProjectRevision | null
  categories: ProjectCategory[]
  tags: ProjectTag[]
  services: ManagementService[]
  attachments: MediaAttachment[]
  attachmentError: string
  preview: ProjectRevision | null
  busy: boolean
  dirty: boolean
  notice: string
  onChange: <Key extends keyof ProjectFormValues>(
    key: Key,
    value: ProjectFormValues[Key],
  ) => void
  onAttachmentsChange: (attachments: MediaAttachment[]) => void
  onSave: (event: FormEvent<HTMLFormElement>) => void
  onClose: () => void
  onPreview: () => void
  onClosePreview: () => void
  onPublish: () => void
  onDiscard: () => void
}

const fieldClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-brand-navy'
const labelClass = 'block text-sm font-medium text-slate-700'

const executionStatuses = [
  { value: 'planning', label: 'Planning' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On hold' },
] as const

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

function displayDate(value: string | null): string {
  if (!value) {
    return '—'
  }
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function toggleId(
  values: number[],
  id: number,
  checked: boolean,
): number[] {
  return checked
    ? [...values, id]
    : values.filter((value) => value !== id)
}

function serviceTitle(service: ManagementService): string {
  return service.published?.title || service.draft?.title || service.slug
}

export function ProjectEditor({
  form,
  revision,
  categories,
  tags,
  services,
  attachments,
  attachmentError,
  preview,
  busy,
  dirty,
  notice,
  onChange,
  onAttachmentsChange,
  onSave,
  onClose,
  onPreview,
  onClosePreview,
  onPublish,
  onDiscard,
}: ProjectEditorProps) {
  const dateError =
    form.start_date &&
    form.completion_date &&
    form.completion_date < form.start_date
      ? 'Completion date cannot be earlier than the start date.'
      : ''
  const clientNameError =
    form.show_client_name && !form.client_name.trim()
      ? 'Enter a client name before choosing to display it publicly.'
      : ''
  const selectedServiceIds = new Set(form.related_services)
  const selectedTagIds = new Set(form.tags)
  const serviceOptions = [
    ...services.filter(
      (service) =>
        !service.is_archived || selectedServiceIds.has(service.id),
    ),
    ...form.related_services
      .filter((id) => !services.some((service) => service.id === id))
      .map((id) => ({
        id,
        slug: '',
        is_archived: true,
        draft: null,
        published: null,
      })),
  ]
  const tagOptions = [
    ...tags.filter((tag) => tag.is_active || selectedTagIds.has(tag.id)),
    ...form.tags
      .filter((id) => !tags.some((tag) => tag.id === id))
      .map((id) => ({
        id,
        name: `Tag ${id}`,
        slug: '',
        is_active: false,
        created_at: '',
        updated_at: '',
      })),
  ]

  return (
    <section
      aria-labelledby="project-editor-heading"
      className="mt-8 rounded-2xl border-2 border-brand-blue/20 bg-slate-50 p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
            {revision
              ? `Draft editor · Revision #${revision.id}`
              : 'New project · not yet saved'}
          </p>
          <h2
            className="mt-1 text-2xl font-bold text-brand-navy"
            id="project-editor-heading"
          >
            {revision
              ? `Edit ${revision.title || revision.slug}`
              : 'Create project'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Changes are saved to a draft. The public project stays unchanged
            until you explicitly publish the draft.
          </p>
        </div>
        <button
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-white disabled:opacity-60"
          disabled={busy}
          onClick={onClose}
          type="button"
        >
          Close editor
        </button>
      </div>

      {notice && (
        <p
          className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900"
          role="status"
        >
          {notice}
        </p>
      )}

      <form
        className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
        onSubmit={(event) => {
          event.preventDefault()
          onSave(event)
        }}
      >
        <div>
          <label className={labelClass} htmlFor="project-url-slug">
            Project URL slug
          </label>
          <input
            aria-describedby="project-url-slug-help"
            className={fieldClass}
            disabled={busy || Boolean(revision)}
            id="project-url-slug"
            maxLength={180}
            onChange={(event) => onChange('slug', event.target.value)}
            required
            value={form.slug}
          />
          <p className="mt-1 text-xs text-slate-500" id="project-url-slug-help">
            This identity is fixed after the project draft is created.
          </p>
        </div>
        <label className={labelClass}>
          Category
          <select
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange(
                'category',
                event.target.value ? Number(event.target.value) : null,
              )
            }
            value={form.category ?? ''}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {!category.is_active ? ' (inactive; publishing blocked)' : ''}
              </option>
            ))}
            {form.category !== null &&
              !categories.some((item) => item.id === form.category) && (
                <option value={form.category}>
                  Category {form.category} (unavailable)
                </option>
              )}
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Project title
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={200}
            onChange={(event) => onChange('title', event.target.value)}
            value={form.title}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Short summary
          <textarea
            className={fieldClass}
            disabled={busy}
            maxLength={300}
            onChange={(event) => onChange('summary', event.target.value)}
            rows={3}
            value={form.summary}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Full project description
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) => onChange('description', event.target.value)}
            rows={6}
            value={form.description}
          />
        </label>
        <label className={labelClass}>
          Location
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={160}
            onChange={(event) => onChange('location', event.target.value)}
            value={form.location}
          />
        </label>
        <label className={labelClass}>
          Country
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={120}
            onChange={(event) => onChange('country', event.target.value)}
            value={form.country}
          />
        </label>
        <label className={labelClass}>
          Start date
          <input
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange('start_date', event.target.value || null)
            }
            type="date"
            value={form.start_date ?? ''}
          />
        </label>
        <label className={labelClass}>
          Completion date
          <input
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange('completion_date', event.target.value || null)
            }
            type="date"
            value={form.completion_date ?? ''}
          />
        </label>
        {dateError && (
          <p className="text-sm text-red-800 sm:col-span-2" role="alert">
            {dateError}
          </p>
        )}
        <label className={labelClass}>
          Execution status
          <select
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange(
                'execution_status',
                event.target.value as ProjectFields['execution_status'],
              )
            }
            value={form.execution_status}
          >
            <option value="">Not specified</option>
            {executionStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Display order
          <input
            className={fieldClass}
            disabled={busy}
            max={32767}
            min={0}
            onChange={(event) =>
              onChange('display_order', Number(event.target.value))
            }
            type="number"
            value={form.display_order}
          />
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
          <input
            checked={form.is_featured}
            disabled={busy}
            onChange={(event) => onChange('is_featured', event.target.checked)}
            type="checkbox"
          />
          Featured project
        </label>
        <section
          aria-labelledby="project-tags-heading"
          className="rounded-lg border border-slate-200 p-4 sm:col-span-2"
        >
          <h3
            className="text-sm font-semibold text-brand-navy"
            id="project-tags-heading"
          >
            Project tags
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Select up to 20 active tags. Inactive selected tags can only be
            removed.
          </p>
          {tagOptions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No project tags are available yet.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tagOptions.map((tag) => {
                const checked = selectedTagIds.has(tag.id)
                const selectionLimitReached =
                  form.tags.length >= 20 && !checked
                return (
                  <label
                    className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm text-slate-700"
                    key={tag.id}
                  >
                    <input
                      checked={checked}
                      disabled={
                        busy ||
                        (!tag.is_active && !checked) ||
                        selectionLimitReached
                      }
                      onChange={(event) =>
                        onChange(
                          'tags',
                          toggleId(form.tags, tag.id, event.target.checked),
                        )
                      }
                      type="checkbox"
                    />
                    {tag.name}
                    {!tag.is_active && ' (inactive; remove before saving)'}
                  </label>
                )
              })}
            </div>
          )}
          {form.tags.length >= 20 && (
            <p className="mt-2 text-xs text-amber-800" role="status">
              The maximum of 20 project tags is selected.
            </p>
          )}
        </section>
        <section
          aria-labelledby="related-services-heading"
          className="rounded-lg border border-slate-200 p-4 sm:col-span-2"
        >
          <h3
            className="text-sm font-semibold text-brand-navy"
            id="related-services-heading"
          >
            Related services
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Select up to 20 non-archived services. Archived selected services
            can only be removed.
          </p>
          {serviceOptions.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No services are available to relate to this project.
            </p>
          ) : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {serviceOptions.map((service) => {
                const checked = selectedServiceIds.has(service.id)
                const archived = service.is_archived
                const selectionLimitReached =
                  form.related_services.length >= 20 && !checked
                return (
                  <label
                    className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm text-slate-700"
                    key={service.id}
                  >
                    <input
                      checked={checked}
                      disabled={
                        busy ||
                        (archived && !checked) ||
                        selectionLimitReached
                      }
                      onChange={(event) =>
                        onChange(
                          'related_services',
                          toggleId(
                            form.related_services,
                            service.id,
                            event.target.checked,
                          ),
                        )
                      }
                      type="checkbox"
                    />
                    {service.slug ? serviceTitle(service) : `Service ${service.id}`}
                    {archived && ' (archived; remove before saving)'}
                  </label>
                )
              })}
            </div>
          )}
          {form.related_services.length >= 20 && (
            <p className="mt-2 text-xs text-amber-800" role="status">
              The maximum of 20 related services is selected.
            </p>
          )}
        </section>
        <label className={labelClass}>
          Client name
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={200}
            onChange={(event) => onChange('client_name', event.target.value)}
            value={form.client_name}
          />
        </label>
        <div>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
            <input
              checked={form.show_client_name}
              disabled={busy}
              onChange={(event) =>
                onChange('show_client_name', event.target.checked)
              }
              type="checkbox"
            />
            Show client name publicly
          </label>
          <p className="mt-2 text-xs text-slate-500">
            The public API returns no client name unless this is enabled.
          </p>
          {clientNameError && (
            <p className="mt-2 text-sm text-red-800" role="alert">
              {clientNameError}
            </p>
          )}
        </div>
        <label className={`${labelClass} sm:col-span-2`}>
          Project background
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange('project_background', event.target.value)
            }
            rows={4}
            value={form.project_background}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Engineering challenge
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange('engineering_challenge', event.target.value)
            }
            rows={4}
            value={form.engineering_challenge}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Proposed solution
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) => onChange('proposed_solution', event.target.value)}
            rows={4}
            value={form.proposed_solution}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Work carried out
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) => onChange('work_carried_out', event.target.value)}
            rows={4}
            value={form.work_carried_out}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Technical specifications
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) =>
              onChange('technical_specifications', event.target.value)
            }
            rows={4}
            value={form.technical_specifications}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Outcomes
          <textarea
            className={fieldClass}
            disabled={busy}
            onChange={(event) => onChange('outcomes', event.target.value)}
            rows={4}
            value={form.outcomes}
          />
        </label>
        <label className={labelClass}>
          SEO title
          <input
            className={fieldClass}
            disabled={busy}
            maxLength={70}
            onChange={(event) => onChange('seo_title', event.target.value)}
            value={form.seo_title}
          />
        </label>
        <label className={labelClass}>
          SEO description
          <textarea
            className={fieldClass}
            disabled={busy}
            maxLength={160}
            onChange={(event) => onChange('seo_description', event.target.value)}
            rows={3}
            value={form.seo_description}
          />
        </label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
          Drafts may be incomplete. Publishing requires a title, short summary,
          and full description. Completion must not precede the start date.
          Displaying a client name requires that a name be provided.
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
            disabled={
              busy ||
              !form.slug.trim() ||
              Boolean(dateError || clientNameError)
            }
            type="submit"
          >
            {busy
              ? 'Saving…'
              : revision
                ? 'Save draft'
                : 'Create project draft'}
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
            disabled={busy || !revision || dirty}
            onClick={onPreview}
            type="button"
          >
            Preview draft
          </button>
          {revision && (
            <button
              className="rounded-lg bg-brand-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              disabled={busy || dirty || revision.status !== 'draft'}
              onClick={onPublish}
              type="button"
            >
              Publish
            </button>
          )}
          {revision && (
            <button
              className="rounded-lg px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
              disabled={busy || revision.status !== 'draft'}
              onClick={onDiscard}
              type="button"
            >
              Discard draft
            </button>
          )}
          {dirty && (
            <p className="text-sm text-amber-800" role="status">
              Save changes before previewing or publishing.
            </p>
          )}
        </div>
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
            editable
            key={revision.id}
            onAttachmentsChange={onAttachmentsChange}
            revisionId={revision.id}
            roles={[
              { value: 'cover_image', label: 'Cover image' },
              { value: 'gallery_image', label: 'Gallery photograph' },
              { value: 'video', label: 'Project video' },
            ]}
            target="project_revision"
          />
        </>
      )}

      {preview && (
        <ContentPreviewDialog
          onClose={onClosePreview}
          title={preview.title || preview.slug}
        >
          <article className="space-y-5">
            <p className="text-sm font-semibold text-brand-blue">
              {categoryName(categories, preview.category)}
            </p>
            <h3 className="text-3xl font-bold text-brand-navy">
              {preview.title}
            </h3>
            {preview.summary && (
              <p className="text-lg text-slate-600">{preview.summary}</p>
            )}
            {preview.location && (
              <p className="text-sm text-slate-600">
                {[preview.location, preview.country].filter(Boolean).join(', ')}
              </p>
            )}
            {(preview.start_date || preview.completion_date) && (
              <p className="text-sm text-slate-600">
                {displayDate(preview.start_date)} –{' '}
                {displayDate(preview.completion_date)}
              </p>
            )}
            {preview.description && (
              <p className="whitespace-pre-wrap leading-7 text-slate-700">
                {preview.description}
              </p>
            )}
            {preview.tags.length > 0 && (
              <ul aria-label="Project tags" className="flex flex-wrap gap-2">
                {preview.tags.map((id) => (
                  <li
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs"
                    key={id}
                  >
                    {tags.find((tag) => tag.id === id)?.name ?? `Tag ${id}`}
                  </li>
                ))}
              </ul>
            )}
            {preview.related_services.length > 0 && (
              <section>
                <h4 className="font-bold">Related services</h4>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-600">
                  {preview.related_services.map((id) => {
                    const service = services.find((item) => item.id === id)
                    return (
                      <li key={id}>
                        {service ? serviceTitle(service) : `Service ${id}`}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {preview.client_name && preview.show_client_name && (
              <p className="text-sm text-slate-600">
                Client: {preview.client_name}
              </p>
            )}
            {[
              ['Project background', preview.project_background],
              ['Engineering challenge', preview.engineering_challenge],
              ['Proposed solution', preview.proposed_solution],
              ['Work carried out', preview.work_carried_out],
              ['Technical specifications', preview.technical_specifications],
              ['Outcomes', preview.outcomes],
            ].map(([heading, content]) =>
              content ? (
                <section key={heading}>
                  <h4 className="font-bold">{heading}</h4>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {content}
                  </p>
                </section>
              ) : null,
            )}
            {attachments.length > 0 && (
              <section aria-label="Draft project media">
                <h4 className="font-bold">Project media</h4>
                <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                  {attachments.map((attachment) => (
                    <li key={attachment.id}>
                      {attachment.asset.media_type === 'image' ? (
                        <img
                          alt={
                            attachment.alt_text_override ||
                            attachment.asset.alt_text ||
                            attachment.asset.title ||
                            attachment.asset.display_filename
                          }
                          className="aspect-video w-full rounded-lg object-cover"
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
                          preload="metadata"
                          src={attachment.asset.content_url}
                        />
                      )}
                      {(attachment.caption_override ||
                        attachment.asset.caption) && (
                        <p className="mt-2 text-sm text-slate-600">
                          {attachment.caption_override ||
                            attachment.asset.caption}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>
        </ContentPreviewDialog>
      )}
    </section>
  )
}
