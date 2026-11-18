import { useState, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from '../cms/ConfirmDialog'
import {
  createServiceCategory,
  updateServiceCategory,
  type ServiceCategory,
  type ServiceCategoryFields,
} from './managementApi'

interface ServiceCategoriesPanelProps {
  categories: ServiceCategory[]
  onCategoriesChanged: () => Promise<void>
}

interface CategoryFormValues extends ServiceCategoryFields {
  slug: string
}

const EMPTY_CATEGORY: CategoryFormValues = {
  name: '',
  slug: '',
  description: '',
  display_order: 0,
}

function messageFor(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The category request could not be completed. Please try again.'
}

const fieldClass =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-brand-navy'
const labelClass = 'block text-sm font-medium text-slate-700'

export function ServiceCategoriesPanel({
  categories,
  onCategoriesChanged,
}: ServiceCategoriesPanelProps) {
  const [createForm, setCreateForm] =
    useState<CategoryFormValues>(EMPTY_CATEGORY)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] =
    useState<CategoryFormValues>(EMPTY_CATEGORY)
  const [pendingStatusChange, setPendingStatusChange] =
    useState<ServiceCategory | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function changeCreateField<Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key],
  ) {
    setCreateForm((current) => ({ ...current, [key]: value }))
  }

  function changeEditField<Key extends keyof CategoryFormValues>(
    key: Key,
    value: CategoryFormValues[Key],
  ) {
    setEditForm((current) => ({ ...current, [key]: value }))
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { slug, ...fields } = createForm
      await createServiceCategory({
        ...fields,
        ...(slug.trim() ? { slug: slug.trim() } : {}),
      })
      setCreateForm(EMPTY_CATEGORY)
      setNotice('Service category created.')
      await onCategoriesChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  function beginEdit(category: ServiceCategory) {
    setEditId(category.id)
    setEditForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      display_order: category.display_order,
    })
    setError('')
    setNotice('')
  }

  async function submitEdit(
    event: FormEvent<HTMLFormElement>,
    category: ServiceCategory,
  ) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateServiceCategory(category.slug, {
        ...editForm,
        slug: editForm.slug.trim(),
        name: editForm.name.trim(),
      })
      setEditId(null)
      setNotice('Service category updated.')
      await onCategoriesChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmStatusChange() {
    if (!pendingStatusChange) {
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await updateServiceCategory(pendingStatusChange.slug, {
        is_active: !pendingStatusChange.is_active,
      })
      setPendingStatusChange(null)
      setNotice(
        `Category ${pendingStatusChange.is_active ? 'deactivated' : 'activated'}. Public service visibility updates immediately.`,
      )
      await onCategoriesChanged()
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="service-categories-heading"
      className="mt-10 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-blue">
            Catalogue configuration
          </p>
          <h2
            className="mt-1 text-xl font-bold text-brand-navy"
            id="service-categories-heading"
          >
            Service categories
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Category activation is immediate, not revisioned. Deactivating a
            category hides its published services from the public catalogue.
          </p>
        </div>
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

      <details className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer font-semibold text-brand-navy">
          Create category
        </summary>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => void submitCreate(event)}
        >
          <label className={labelClass}>
            Category name
            <input
              className={fieldClass}
              disabled={busy}
              maxLength={100}
              onChange={(event) => changeCreateField('name', event.target.value)}
              required
              value={createForm.name}
            />
          </label>
          <label className={labelClass}>
            URL slug (optional)
            <input
              className={fieldClass}
              disabled={busy}
              maxLength={120}
              onChange={(event) => changeCreateField('slug', event.target.value)}
              value={createForm.slug}
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
                changeCreateField('display_order', Number(event.target.value))
              }
              type="number"
              value={createForm.display_order}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Description (optional)
            <textarea
              className={fieldClass}
              disabled={busy}
              onChange={(event) =>
                changeCreateField('description', event.target.value)
              }
              rows={3}
              value={createForm.description}
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

      {categories.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No service categories are configured.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200">
          {categories.map((category) => (
            <li className="py-5" key={category.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-brand-navy">
                      {category.name}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        category.is_active
                          ? 'bg-emerald-100 text-emerald-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    /{category.slug} · Order {category.display_order}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
                    onClick={() =>
                      editId === category.id
                        ? setEditId(null)
                        : beginEdit(category)
                    }
                    type="button"
                  >
                    {editId === category.id ? 'Close editor' : 'Edit'}
                  </button>
                  <button
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                    disabled={busy}
                    onClick={() => setPendingStatusChange(category)}
                    type="button"
                  >
                    {category.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
              {editId === category.id && (
                <form
                  className="mt-4 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"
                  onSubmit={(event) => void submitEdit(event, category)}
                >
                  <label className={labelClass}>
                    Category name
                    <input
                      className={fieldClass}
                      disabled={busy}
                      maxLength={100}
                      onChange={(event) =>
                        changeEditField('name', event.target.value)
                      }
                      required
                      value={editForm.name}
                    />
                  </label>
                  <label className={labelClass}>
                    URL slug
                    <input
                      className={fieldClass}
                      disabled={busy}
                      maxLength={120}
                      onChange={(event) =>
                        changeEditField('slug', event.target.value)
                      }
                      required
                      value={editForm.slug}
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
                        changeEditField(
                          'display_order',
                          Number(event.target.value),
                        )
                      }
                      type="number"
                      value={editForm.display_order}
                    />
                  </label>
                  <label className={`${labelClass} sm:col-span-2`}>
                    Description
                    <textarea
                      className={fieldClass}
                      disabled={busy}
                      onChange={(event) =>
                        changeEditField('description', event.target.value)
                      }
                      rows={3}
                      value={editForm.description}
                    />
                  </label>
                  <button
                    className="w-fit rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? 'Saving…' : 'Save category'}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {pendingStatusChange && (
        <ConfirmDialog
          busy={busy}
          confirmLabel={
            pendingStatusChange.is_active ? 'Deactivate category' : 'Activate category'
          }
          description={
            pendingStatusChange.is_active
              ? `Deactivating “${pendingStatusChange.name}” immediately hides published services in that category. This is not a draft change.`
              : `Activating “${pendingStatusChange.name}” may immediately make eligible published services public again.`
          }
          onCancel={() => setPendingStatusChange(null)}
          onConfirm={() => void confirmStatusChange()}
          title={
            pendingStatusChange.is_active
              ? 'Deactivate service category?'
              : 'Activate service category?'
          }
        />
      )}
    </section>
  )
}
