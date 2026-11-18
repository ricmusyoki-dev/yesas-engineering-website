import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { ContentPreviewDialog } from '../cms/ContentPreviewDialog'
import { MediaAttachmentsManager } from '../cms/MediaAttachmentsManager'
import type { MediaAttachment } from '../cms/types'
import type {
  ServiceCategory,
  ServiceFields,
  ServiceRevision,
} from './managementApi'

export interface ServiceFormValues extends ServiceFields {
  slug: string
}

interface ServiceEditorProps {
  form: ServiceFormValues
  revision: ServiceRevision | null
  categories: ServiceCategory[]
  attachments: MediaAttachment[]
  attachmentError: string
  preview: ServiceRevision | null
  busy: boolean
  dirty: boolean
  notice: string
  onChange: <Key extends keyof ServiceFormValues>(
    key: Key,
    value: ServiceFormValues[Key],
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

export function ServiceEditor({
  form,
  revision,
  categories,
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
}: ServiceEditorProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const editable = revision === null || revision.status === 'draft'
  const selectedCategory = categories.find(
    (category) => category.id === form.category,
  )

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSave(event)
  }

  return (
    <section
      aria-labelledby="service-editor-heading"
      className="mt-8 rounded-2xl border-2 border-brand-blue/20 bg-slate-50 p-5 sm:p-8"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
            {revision
              ? `Draft editor · Revision #${revision.id}`
              : 'New service · not yet saved'}
          </p>
          <h2
            className="mt-1 text-2xl font-bold text-brand-navy"
            id="service-editor-heading"
          >
            {revision ? `Edit ${revision.title || revision.slug}` : 'Create service'}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Changes are saved to a draft. The public service remains unchanged
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
        <p className="mt-5 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      )}

      <form
        className="mt-6 grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 sm:p-7"
        onSubmit={submit}
      >
        <div>
          <label className={labelClass} htmlFor="service-url-slug">
            Service URL slug
          </label>
          <input
            className={fieldClass}
            aria-describedby="service-url-slug-help"
            disabled={busy || Boolean(revision)}
            id="service-url-slug"
            maxLength={180}
            onChange={(event) => onChange('slug', event.target.value)}
            required
            value={form.slug}
          />
          <p className="mt-1 text-xs text-slate-500" id="service-url-slug-help">
            This identity is fixed after the service draft is created.
          </p>
        </div>
        <label className={labelClass}>
          Category
          <select
            className={fieldClass}
            disabled={busy || !editable}
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
            {form.category !== null && !selectedCategory && (
              <option value={form.category}>
                Category {form.category} (unavailable)
              </option>
            )}
          </select>
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Service title
          <input
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={200}
            onChange={(event) => onChange('title', event.target.value)}
            value={form.title}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Short summary
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={300}
            onChange={(event) => onChange('summary', event.target.value)}
            rows={3}
            value={form.summary}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Detailed description
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            onChange={(event) => onChange('description', event.target.value)}
            rows={6}
            value={form.description}
          />
        </label>
        <label className={labelClass}>
          Display order
          <input
            className={fieldClass}
            disabled={busy || !editable}
            max={32767}
            min={0}
            onChange={(event) =>
              onChange('display_order', Number(event.target.value))
            }
            type="number"
            value={form.display_order}
          />
        </label>
        <div className="grid gap-3 self-end sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
            <input
              checked={form.is_enabled}
              disabled={busy || !editable}
              onChange={(event) => onChange('is_enabled', event.target.checked)}
              type="checkbox"
            />
            Enabled when published
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-700">
            <input
              checked={form.is_featured}
              disabled={busy || !editable}
              onChange={(event) =>
                onChange('is_featured', event.target.checked)
              }
              type="checkbox"
            />
            Featured when published
          </label>
        </div>
        <label className={labelClass}>
          Features (one per line, up to 20)
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            onChange={(event) =>
              onChange(
                'features',
                event.target.value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
            rows={5}
            value={form.features.join('\n')}
          />
        </label>
        <label className={labelClass}>
          Benefits (one per line, up to 20)
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            onChange={(event) =>
              onChange(
                'benefits',
                event.target.value
                  .split('\n')
                  .map((item) => item.trim())
                  .filter(Boolean),
              )
            }
            rows={5}
            value={form.benefits.join('\n')}
          />
        </label>
        <label className={`${labelClass} sm:col-span-2`}>
          Process
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            onChange={(event) => onChange('process', event.target.value)}
            rows={4}
            value={form.process}
          />
        </label>
        <label className={labelClass}>
          Call-to-action label
          <input
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={100}
            onChange={(event) => onChange('cta_label', event.target.value)}
            value={form.cta_label}
          />
        </label>
        <label className={labelClass}>
          Call-to-action destination
          <input
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={500}
            onChange={(event) => onChange('cta_destination', event.target.value)}
            value={form.cta_destination}
          />
        </label>
        <label className={labelClass}>
          SEO title
          <input
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={70}
            onChange={(event) => onChange('seo_title', event.target.value)}
            value={form.seo_title}
          />
        </label>
        <label className={labelClass}>
          SEO description
          <textarea
            className={fieldClass}
            disabled={busy || !editable}
            maxLength={160}
            onChange={(event) => onChange('seo_description', event.target.value)}
            rows={3}
            value={form.seo_description}
          />
        </label>
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
          Drafts may be incomplete. Publishing requires a title, summary, and
          detailed description; each feature and benefit must be non-empty, and
          a CTA label and destination must be supplied together.
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
            disabled={
              busy ||
              !editable ||
              (Boolean(revision) && !dirty) ||
              !form.slug.trim()
            }
            type="submit"
          >
            {busy
              ? 'Saving…'
              : revision
                ? 'Save draft'
                : 'Create service draft'}
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
              onClick={() => setConfirmDiscard(true)}
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
            editable={revision.status === 'draft'}
            key={`${revision.id}-${revision.status}`}
            onAttachmentsChange={onAttachmentsChange}
            revisionId={revision.id}
            roles={[
              { value: 'cover_image', label: 'Cover image' },
              { value: 'gallery_image', label: 'Gallery image' },
              { value: 'video', label: 'Service video' },
            ]}
            target="service_revision"
          />
        </>
      )}

      {confirmDiscard && revision && (
        <ConfirmDialog
          busy={busy}
          confirmLabel="Discard draft"
          description="This permanently removes the current draft. A previously published version remains live; if no other revision exists, the service identity is removed."
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() => {
            setConfirmDiscard(false)
            onDiscard()
          }}
          title="Discard service draft?"
        />
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
            {preview.description && (
              <p className="whitespace-pre-wrap leading-7 text-slate-700">
                {preview.description}
              </p>
            )}
            {preview.features.length > 0 && (
              <section>
                <h4 className="font-bold">Features</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {preview.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
              </section>
            )}
            {preview.benefits.length > 0 && (
              <section>
                <h4 className="font-bold">Benefits</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                  {preview.benefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
                  ))}
                </ul>
              </section>
            )}
            {preview.process && (
              <section>
                <h4 className="font-bold">Process</h4>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                  {preview.process}
                </p>
              </section>
            )}
            {preview.cta_label && (
              <p className="inline-flex rounded-lg bg-brand-orange px-4 py-2 font-semibold text-white">
                {preview.cta_label}
              </p>
            )}
            {attachments.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
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
          </article>
        </ContentPreviewDialog>
      )}
    </section>
  )
}
