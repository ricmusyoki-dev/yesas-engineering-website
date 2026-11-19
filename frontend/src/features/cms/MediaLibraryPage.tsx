import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { SessionApiError } from '../auth/api'
import { ConfirmDialog } from './ConfirmDialog'
import {
  archiveAsset,
  listAssets,
  restoreAsset,
  updateAsset,
  uploadAsset,
  type MediaUploadMetadata,
} from './mediaApi'
import type { MediaAsset, MediaLifecycle, MediaType } from './types'

const PAGE_SIZE = 20

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

function errorMessage(error: unknown): string {
  return error instanceof SessionApiError
    ? error.message
    : 'The media request could not be completed. Please try again.'
}

export function MediaLibraryPage() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [mediaType, setMediaType] = useState<MediaType | ''>('')
  const [lifecycle, setLifecycle] = useState<MediaLifecycle | ''>('active')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null)
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null)
  const [archiveAssetTarget, setArchiveAssetTarget] = useState<MediaAsset | null>(null)
  const [metadata, setMetadata] = useState<MediaUploadMetadata & { display_filename: string }>({
    display_filename: '',
  })

  async function loadAssets() {
    setLoading(true)
    setError('')
    try {
      const response = await listAssets({
        page,
        page_size: PAGE_SIZE,
        search: search || undefined,
        media_type: mediaType || undefined,
        lifecycle: lifecycle || undefined,
      })
      setAssets(response.results)
      setCount(response.count)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAssets()
  }, [page, mediaType, lifecycle])

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPage(1)
    await loadAssets()
  }

  function supportedFile(file: File): boolean {
    const extension = file.name.split('.').pop()?.toLowerCase()
    return (
      ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(file.type) ||
      ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'].includes(extension ?? '')
    )
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('Choose an image or video file to upload.')
      return
    }
    if (!supportedFile(file)) {
      setError('Choose a JPEG, PNG, WebP, MP4, or WebM file.')
      return
    }

    setUploading(true)
    setBusy(true)
    try {
      const asset = await uploadAsset(file, {})
      if (fileInput.current) fileInput.current.value = ''
      setAssets((current) => [asset, ...current.filter((item) => item.id !== asset.id)])
      setCount((current) => current + 1)
      setNotice(`${asset.display_filename} uploaded successfully.`)
      setSelectedAsset(asset)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setUploading(false)
      setBusy(false)
    }
  }

  function openEditor(asset: MediaAsset) {
    setEditingAsset(asset)
    setMetadata({
      display_filename: asset.display_filename,
      title: asset.title,
      description: asset.description,
      alt_text: asset.alt_text,
      caption: asset.caption,
      credit: asset.credit,
      accessibility_description: asset.accessibility_description,
    })
  }

  function updateMetadata(field: keyof typeof metadata, value: string) {
    setMetadata((current) => ({ ...current, [field]: value }))
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingAsset) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await updateAsset(editingAsset.id, metadata)
      setAssets((current) =>
        current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      setEditingAsset(null)
      setNotice(`${updated.display_filename} metadata saved.`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmArchive() {
    if (!archiveAssetTarget) return
    setBusy(true)
    setError('')
    try {
      const updated = await archiveAsset(archiveAssetTarget.id)
      setAssets((current) =>
        lifecycle === 'active'
          ? current.filter((asset) => asset.id !== updated.id)
          : current.map((asset) => (asset.id === updated.id ? updated : asset)),
      )
      setArchiveAssetTarget(null)
      setSelectedAsset(null)
      setNotice(`${updated.display_filename} was archived. It is not deleted.`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleRestore(asset: MediaAsset) {
    setBusy(true)
    setError('')
    try {
      const updated = await restoreAsset(asset.id)
      setAssets((current) =>
        lifecycle === 'archived'
          ? current.filter((item) => item.id !== updated.id)
          : current.map((item) => (item.id === updated.id ? updated : item)),
      )
      setNotice(`${updated.display_filename} was restored.`)
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE))

  return (
    <div>
      <div className="border-b border-slate-200 pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
          Website management
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Media Library</h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Upload, find, preview, and manage reusable website media.
        </p>
      </div>

      {error && <p className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{error}</p>}
      {notice && <p className="mt-6 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900" role="status">{notice}</p>}

      <form className="mt-7 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleUpload}>
        <label className="text-sm font-medium text-slate-700">
          Upload image or video
          <input
            accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
            disabled={busy}
            ref={fileInput}
            type="file"
          />
        </label>
        <div className="flex items-end">
          <button className="w-full rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60 sm:w-auto" disabled={busy} type="submit">
            {uploading ? 'Uploading…' : 'Upload media'}
          </button>
        </div>
        {uploading && <progress aria-label="Media upload in progress" className="h-2 w-full accent-brand-blue sm:col-span-2" />}
        <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
          Accepted formats: JPEG, PNG, WebP, MP4, WebM. The server enforces size and image-dimension limits.
        </p>
      </form>

      <div className="mt-7 rounded-xl border border-slate-200 bg-white p-5">
        <form className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_10rem_10rem_auto]" onSubmit={handleSearch}>
          <label className="text-sm font-medium text-slate-700">
            Search
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Title or filename"
              value={search}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Media type
            <select className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" onChange={(event) => { setPage(1); setMediaType(event.target.value as MediaType | '') }} value={mediaType}>
              <option value="">All</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Status
            <select className="mt-1 block w-full rounded-lg border border-slate-300 p-2 text-sm" onChange={(event) => { setPage(1); setLifecycle(event.target.value as MediaLifecycle | '') }} value={lifecycle}>
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <div className="flex items-end">
            <button className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-brand-navy hover:bg-slate-50" type="submit">Search</button>
          </div>
        </form>
      </div>

      {loading ? (
        <p className="mt-7 text-sm text-slate-600" role="status">Loading media…</p>
      ) : assets.length === 0 ? (
        <div className="mt-7 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-semibold text-brand-navy">No media found</p>
          <p className="mt-2 text-sm text-slate-600">Upload a file or change the current filters.</p>
        </div>
      ) : (
        <ul className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" key={asset.id}>
              <button className="block w-full text-left focus-visible:outline-2 focus-visible:outline-brand-orange" onClick={() => setSelectedAsset(asset)} type="button">
                {asset.media_type === 'image' ? (
                  <img alt={asset.alt_text || asset.title || asset.display_filename} className="aspect-video w-full bg-slate-100 object-cover" src={asset.thumbnail_url ?? asset.content_url} />
                ) : (
                  <div className="relative aspect-video w-full bg-brand-navy">
                    <video aria-label={asset.title || asset.display_filename} className="h-full w-full object-cover" preload="metadata" src={asset.content_url} />
                    <span className="absolute left-3 top-3 rounded-full bg-white px-2 py-1 text-xs font-bold text-brand-navy">Video</span>
                  </div>
                )}
                <div className="p-4">
                  <p className="truncate font-semibold text-brand-navy">{asset.title || asset.display_filename}</p>
                  <p className="mt-1 text-xs text-slate-500">{asset.media_type} · {formatBytes(asset.file_size)} · {formatDate(asset.created_at)}</p>
                  <span className={`mt-3 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${asset.lifecycle === 'active' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'}`}>{asset.lifecycle}</span>
                </div>
              </button>
              <div className="flex gap-2 border-t border-slate-200 p-3">
                <button className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-50" onClick={() => openEditor(asset)} type="button">Edit details</button>
                {asset.lifecycle === 'active' ? (
                  <button className="rounded px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-50" disabled={busy} onClick={() => setArchiveAssetTarget(asset)} type="button">Archive</button>
                ) : (
                  <button className="rounded px-3 py-2 text-xs font-semibold text-brand-blue hover:bg-slate-50" disabled={busy} onClick={() => void handleRestore(asset)} type="button">Restore</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {count > 0 && (
        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{count} asset{count === 1 ? '' : 's'} · Page {page} of {pageCount}</p>
          <div className="flex gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={page === 1} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
          </div>
        </div>
      )}

      {selectedAsset && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="asset-preview-title">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">{selectedAsset.media_type}</p>
                <h2 className="mt-1 text-xl font-bold text-brand-navy" id="asset-preview-title">{selectedAsset.title || selectedAsset.display_filename}</h2>
              </div>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => setSelectedAsset(null)} type="button">Close</button>
            </div>
            {selectedAsset.media_type === 'image' ? (
              <img alt={selectedAsset.alt_text || selectedAsset.title || selectedAsset.display_filename} className="mt-5 max-h-[55vh] w-full rounded-lg bg-slate-100 object-contain" onError={() => setError('The image preview could not be loaded.')} src={selectedAsset.thumbnail_url ?? selectedAsset.content_url} />
            ) : (
              <video aria-label={selectedAsset.title || selectedAsset.display_filename} className="mt-5 max-h-[55vh] w-full rounded-lg bg-slate-950" controls preload="metadata" src={selectedAsset.content_url} onError={() => setError('The video preview could not be loaded.')} />
            )}
            <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-slate-700">File</dt><dd className="mt-1 break-all text-slate-600">{selectedAsset.display_filename}</dd></div>
              <div><dt className="font-semibold text-slate-700">Size</dt><dd className="mt-1 text-slate-600">{formatBytes(selectedAsset.file_size)}</dd></div>
              <div><dt className="font-semibold text-slate-700">Uploaded</dt><dd className="mt-1 text-slate-600">{formatDate(selectedAsset.created_at)}</dd></div>
              <div><dt className="font-semibold text-slate-700">Status</dt><dd className="mt-1 text-slate-600">{selectedAsset.lifecycle}</dd></div>
            </dl>
          </div>
        </div>
      )}

      {editingAsset && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-media-title">
          <form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onSubmit={saveMetadata}>
            <h2 className="text-xl font-bold text-brand-navy" id="edit-media-title">Edit media details</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {([
                ['display_filename', 'Filename', 255],
                ['title', 'Title', 200],
                ['alt_text', 'Alternative text', 500],
                ['caption', 'Caption', 500],
                ['credit', 'Credit', 255],
              ] as const).map(([field, label, maxLength]) => (
                <label className="text-sm font-medium text-slate-700" key={field}>
                  {label}
                  <input className="mt-1 block w-full rounded-lg border border-slate-300 p-2.5" disabled={busy} maxLength={maxLength} onChange={(event: ChangeEvent<HTMLInputElement>) => updateMetadata(field, event.target.value)} value={metadata[field] ?? ''} />
                </label>
              ))}
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Description
                <textarea className="mt-1 block min-h-24 w-full rounded-lg border border-slate-300 p-2.5" disabled={busy} onChange={(event) => updateMetadata('description', event.target.value)} value={metadata.description ?? ''} />
              </label>
              <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                Accessibility description
                <textarea className="mt-1 block min-h-24 w-full rounded-lg border border-slate-300 p-2.5" disabled={busy} onChange={(event) => updateMetadata('accessibility_description', event.target.value)} value={metadata.accessibility_description ?? ''} />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold" disabled={busy} onClick={() => setEditingAsset(null)} type="button">Cancel</button>
              <button className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">Save details</button>
            </div>
          </form>
        </div>
      )}

      {archiveAssetTarget && (
        <ConfirmDialog
          busy={busy}
          confirmLabel="Archive asset"
          description="This archives the asset and keeps it out of active reuse. The file is not deleted. Publicly referenced assets cannot be archived."
          onCancel={() => setArchiveAssetTarget(null)}
          onConfirm={() => void confirmArchive()}
          title={`Archive ${archiveAssetTarget.display_filename}?`}
        />
      )}
    </div>
  )
}
