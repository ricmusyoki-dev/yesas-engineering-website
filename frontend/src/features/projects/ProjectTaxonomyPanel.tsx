import { useState, type FormEvent } from 'react'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import { SessionApiError } from '../auth/api'
import {
  createProjectCategory,
  createProjectTag,
  updateProjectCategory,
  updateProjectTag,
  type ProjectCategory,
  type ProjectCategoryFields,
  type ProjectTag,
  type ProjectTagFields,
} from './managementApi'

interface ProjectTaxonomyPanelProps {
  categories: ProjectCategory[]
  tags: ProjectTag[]
  onTaxonomyChanged: () => Promise<void>
}

interface CategoryFormValues extends ProjectCategoryFields {
  slug: string
}

interface TagFormValues extends ProjectTagFields {
  slug: string
}

const EMPTY_CATEGORY: CategoryFormValues = {
  name: '',
  slug: '',
  description: '',
  display_order: 0,
}

const EMPTY_TAG: TagFormValues = { name: '', slug: '' }

const fieldClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-brand-navy'
const labelClass = 'block text-sm font-medium text-slate-700'

function messageFor(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The project catalogue request could not be completed. Please try again.'
}

type StatusTarget =
  | { kind: 'category'; value: ProjectCategory }
  | { kind: 'tag'; value: ProjectTag }

export function ProjectTaxonomyPanel({
  categories,
  tags,
  onTaxonomyChanged,
}: ProjectTaxonomyPanelProps) {
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormValues>(EMPTY_CATEGORY)
  const [tagForm, setTagForm] = useState<TagFormValues>(EMPTY_TAG)
  const [editingCategory, setEditingCategory] =
    useState<ProjectCategory | null>(null)
  const [editingTag, setEditingTag] = useState<ProjectTag | null>(null)
  const [categoryEditForm, setCategoryEditForm] =
    useState<CategoryFormValues>(EMPTY_CATEGORY)
  const [tagEditForm, setTagEditForm] = useState<TagFormValues>(EMPTY_TAG)
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { slug, ...fields } = categoryForm
      await createProjectCategory({
        ...fields,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      })
      setCategoryForm(EMPTY_CATEGORY)
      setNotice('Project category created.')
      await onTaxonomyChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function submitTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { slug, ...fields } = tagForm
      await createProjectTag({
        ...fields,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      })
      setTagForm(EMPTY_TAG)
      setNotice('Project tag created.')
      await onTaxonomyChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  function beginEditCategory(category: ProjectCategory) {
    setEditingCategory(category)
    setCategoryEditForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      display_order: category.display_order,
    })
    setEditingTag(null)
    setError('')
    setNotice('')
  }

  function beginEditTag(tag: ProjectTag) {
    setEditingTag(tag)
    setTagEditForm({ name: tag.name, slug: tag.slug })
    setEditingCategory(null)
    setError('')
    setNotice('')
  }

  async function submitCategoryEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingCategory) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateProjectCategory(editingCategory.slug, {
        ...categoryEditForm,
        name: categoryEditForm.name.trim(),
        slug: categoryEditForm.slug.trim(),
      })
      setEditingCategory(null)
      setNotice('Project category updated.')
      await onTaxonomyChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function submitTagEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingTag) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateProjectTag(editingTag.slug, {
        ...tagEditForm,
        name: tagEditForm.name.trim(),
        slug: tagEditForm.slug.trim(),
      })
      setEditingTag(null)
      setNotice('Project tag updated.')
      await onTaxonomyChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmStatusChange() {
    if (!statusTarget) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const active = !statusTarget.value.is_active
      if (statusTarget.kind === 'category') {
        await updateProjectCategory(statusTarget.value.slug, {
          is_active: active,
        })
      } else {
        await updateProjectTag(statusTarget.value.slug, {
          is_active: active,
        })
      }
      setNotice(
        `${statusTarget.kind === 'category' ? 'Category' : 'Tag'} ${active ? 'activated' : 'deactivated'}.`,
      )
      setStatusTarget(null)
      await onTaxonomyChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="project-taxonomy-heading"
      className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
          Catalogue configuration
        </p>
        <h2
          className="mt-1 text-xl font-bold text-brand-navy"
          id="project-taxonomy-heading"
        >
          Project categories and tags
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Deactivation takes effect immediately. Inactive categories prevent
          publication and hide categorized projects publicly; inactive tags
          cannot be assigned or published.
        </p>
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

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-brand-navy">
              Create category
            </summary>
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => void submitCategory(event)}
            >
              <label className={labelClass}>
                Category name
                <input
                  className={fieldClass}
                  disabled={busy}
                  maxLength={100}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={categoryForm.name}
                />
              </label>
              <label className={labelClass}>
                URL slug (optional)
                <input
                  className={fieldClass}
                  disabled={busy}
                  maxLength={120}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  value={categoryForm.slug}
                />
              </label>
              <label className={labelClass}>
                Display order
                <input
                  className={fieldClass}
                  disabled={busy}
                  max={32767}
                  min={0}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      display_order: Number(event.target.value),
                    }))
                  }
                  type="number"
                  value={categoryForm.display_order}
                />
              </label>
              <label className={labelClass}>
                Description
                <textarea
                  className={fieldClass}
                  disabled={busy}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  value={categoryForm.description}
                />
              </label>
              <button
                className="w-fit rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Saving…' : 'Create category'}
              </button>
            </form>
          </details>

          <h3 className="mt-5 font-semibold text-brand-navy">Categories</h3>
          {categories.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No project categories are configured.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {categories.map((category) => (
                <li className="py-4" key={category.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{category.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        /{category.slug} · Order {category.display_order} ·{' '}
                        {category.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                        onClick={() =>
                          editingCategory?.id === category.id
                            ? setEditingCategory(null)
                            : beginEditCategory(category)
                        }
                        type="button"
                      >
                        {editingCategory?.id === category.id
                          ? 'Close editor'
                          : 'Edit'}
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                        disabled={busy}
                        onClick={() =>
                          setStatusTarget({ kind: 'category', value: category })
                        }
                        type="button"
                      >
                        {category.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                  {editingCategory?.id === category.id && (
                    <form
                      className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4"
                      onSubmit={(event) => void submitCategoryEdit(event)}
                    >
                      <label className={labelClass}>
                        Category name
                        <input
                          className={fieldClass}
                          disabled={busy}
                          maxLength={100}
                          onChange={(event) =>
                            setCategoryEditForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          required
                          value={categoryEditForm.name}
                        />
                      </label>
                      <label className={labelClass}>
                        URL slug
                        <input
                          className={fieldClass}
                          disabled={busy}
                          maxLength={120}
                          onChange={(event) =>
                            setCategoryEditForm((current) => ({
                              ...current,
                              slug: event.target.value,
                            }))
                          }
                          required
                          value={categoryEditForm.slug}
                        />
                      </label>
                      <label className={labelClass}>
                        Display order
                        <input
                          className={fieldClass}
                          disabled={busy}
                          max={32767}
                          min={0}
                          onChange={(event) =>
                            setCategoryEditForm((current) => ({
                              ...current,
                              display_order: Number(event.target.value),
                            }))
                          }
                          type="number"
                          value={categoryEditForm.display_order}
                        />
                      </label>
                      <label className={labelClass}>
                        Description
                        <textarea
                          className={fieldClass}
                          disabled={busy}
                          onChange={(event) =>
                            setCategoryEditForm((current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                          rows={3}
                          value={categoryEditForm.description}
                        />
                      </label>
                      <button
                        className="w-fit rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={busy}
                        type="submit"
                      >
                        Save category
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer font-semibold text-brand-navy">
              Create tag
            </summary>
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => void submitTag(event)}
            >
              <label className={labelClass}>
                Tag name
                <input
                  className={fieldClass}
                  disabled={busy}
                  maxLength={50}
                  onChange={(event) =>
                    setTagForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                  value={tagForm.name}
                />
              </label>
              <label className={labelClass}>
                URL slug (optional)
                <input
                  className={fieldClass}
                  disabled={busy}
                  maxLength={60}
                  onChange={(event) =>
                    setTagForm((current) => ({
                      ...current,
                      slug: event.target.value,
                    }))
                  }
                  value={tagForm.slug}
                />
              </label>
              <button
                className="w-fit rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                disabled={busy}
                type="submit"
              >
                {busy ? 'Saving…' : 'Create tag'}
              </button>
            </form>
          </details>

          <h3 className="mt-5 font-semibold text-brand-navy">Tags</h3>
          {tags.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No project tags are configured.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {tags.map((tag) => (
                <li className="py-4" key={tag.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{tag.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        /{tag.slug} · {tag.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
                        onClick={() =>
                          editingTag?.id === tag.id
                            ? setEditingTag(null)
                            : beginEditTag(tag)
                        }
                        type="button"
                      >
                        {editingTag?.id === tag.id ? 'Close editor' : 'Edit'}
                      </button>
                      <button
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
                        disabled={busy}
                        onClick={() =>
                          setStatusTarget({ kind: 'tag', value: tag })
                        }
                        type="button"
                      >
                        {tag.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                  {editingTag?.id === tag.id && (
                    <form
                      className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4"
                      onSubmit={(event) => void submitTagEdit(event)}
                    >
                      <label className={labelClass}>
                        Tag name
                        <input
                          className={fieldClass}
                          disabled={busy}
                          maxLength={50}
                          onChange={(event) =>
                            setTagEditForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          required
                          value={tagEditForm.name}
                        />
                      </label>
                      <label className={labelClass}>
                        URL slug
                        <input
                          className={fieldClass}
                          disabled={busy}
                          maxLength={60}
                          onChange={(event) =>
                            setTagEditForm((current) => ({
                              ...current,
                              slug: event.target.value,
                            }))
                          }
                          required
                          value={tagEditForm.slug}
                        />
                      </label>
                      <button
                        className="w-fit rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        disabled={busy}
                        type="submit"
                      >
                        Save tag
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {statusTarget && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            statusTarget.value.is_active
              ? `Deactivate ${statusTarget.kind}`
              : `Activate ${statusTarget.kind}`
          }
          description={
            statusTarget.kind === 'category'
              ? statusTarget.value.is_active
                ? `Deactivating “${statusTarget.value.name}” immediately hides published projects in this category and blocks publication of drafts assigned to it.`
                : `Activating “${statusTarget.value.name}” may immediately make eligible published projects public again.`
              : statusTarget.value.is_active
                ? `Deactivating “${statusTarget.value.name}” prevents it from being assigned or included in a published project.`
                : `Activating “${statusTarget.value.name}” makes it available for project drafts.`
          }
          onCancel={() => setStatusTarget(null)}
          onConfirm={() => void confirmStatusChange()}
          title={`${
            statusTarget.value.is_active ? 'Deactivate' : 'Activate'
          } project ${statusTarget.kind}?`}
        />
      )}
    </section>
  )
}
