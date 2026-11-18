import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { SessionApiError } from '../auth/api'
import {
  createAttachment,
  detachAttachment,
  updateAttachment,
  uploadAsset,
  type AttachmentTarget,
  type CreateAttachmentPayload,
  type MediaUploadMetadata,
  type UpdateAttachmentPayload,
} from './mediaApi'
import type {
  AttachmentRole,
  MediaAsset,
  MediaAttachment,
} from './types'
import { ConfirmDialog } from './ConfirmDialog'

export interface AttachmentRoleOption {
  value: AttachmentRole
  label: string
}

interface MediaAttachmentsManagerProps {
  target: AttachmentTarget
  revisionId: number
  attachments: MediaAttachment[]
  roles: AttachmentRoleOption[]
  editable: boolean
  onAttachmentsChange: (attachments: MediaAttachment[]) => void
}

function messageFor(error: unknown): string {
  if (error instanceof SessionApiError) {
    return error.message
  }
  return 'The media request could not be completed. Please try again.'
}

function isSupportedFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase()
  return (
    ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(
      file.type,
    ) ||
    ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'webm'].includes(extension ?? '')
  )
}

function matchesRole(file: File, attachmentRole: AttachmentRole): boolean {
  const isVideo =
    file.type.startsWith('video/') ||
    ['mp4', 'webm'].includes(file.name.split('.').pop()?.toLowerCase() ?? '')
  const expectsVideo =
    attachmentRole === 'video' || attachmentRole.endsWith('_video')
  return isVideo === expectsVideo
}

function assetPreviewUrl(asset: MediaAsset): string {
  return asset.thumbnail_url ?? asset.content_url
}

export function MediaAttachmentsManager({
  target,
  revisionId,
  attachments,
  roles,
  editable,
  onAttachmentsChange,
}: MediaAttachmentsManagerProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [role, setRole] = useState<AttachmentRole>(roles[0]?.value ?? 'section_image')
  const [uploadMetadata, setUploadMetadata] = useState<MediaUploadMetadata>({
    title: '',
    alt_text: '',
  })
  const [pendingAsset, setPendingAsset] = useState<MediaAsset | null>(null)
  const [pendingChanges, setPendingChanges] = useState<
    Record<number, UpdateAttachmentPayload>
  >({})
  const [removingAttachment, setRemovingAttachment] =
    useState<MediaAttachment | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  function replaceAttachment(updated: MediaAttachment) {
    onAttachmentsChange(
      attachments.map((attachment) =>
        attachment.id === updated.id ? updated : attachment,
      ),
    )
  }

  async function attachUploadedAsset(asset: MediaAsset) {
    setBusy(true)
    setError('')
    const payload: CreateAttachmentPayload = {
      asset: asset.id,
      role,
      display_order:
        attachments.reduce(
          (maximum, attachment) =>
            Math.max(maximum, attachment.display_order),
          -1,
        ) + 1,
    }
    try {
      const attachment = await createAttachment(target, revisionId, payload)
      onAttachmentsChange([...attachments, attachment])
      setPendingAsset(null)
    } catch (requestError) {
      setPendingAsset(asset)
      setError(
        `${messageFor(requestError)} The file was uploaded; retry attachment without uploading it again.`,
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const file = fileInput.current?.files?.[0]
    if (!file) {
      setError('Choose an image or video file to upload.')
      return
    }
    if (!isSupportedFile(file)) {
      setError('Choose a JPEG, PNG, WebP, MP4, or WebM file.')
      return
    }
    if (!matchesRole(file, role)) {
      setError(
        role === 'video' || role.endsWith('_video')
          ? 'Choose a video for this role.'
          : 'Choose an image for this role.',
      )
      return
    }

    setBusy(true)
    setUploading(true)
    try {
      const asset = await uploadAsset(file, uploadMetadata)
      if (fileInput.current) {
        fileInput.current.value = ''
      }
      setUploading(false)
      setBusy(false)
      await attachUploadedAsset(asset)
    } catch (requestError) {
      setError(messageFor(requestError))
      setUploading(false)
      setBusy(false)
    }
  }

  async function saveAttachment(attachment: MediaAttachment) {
    const changes = pendingChanges[attachment.id]
    if (!changes) {
      return
    }
    setBusy(true)
    setError('')
    try {
      const updated = await updateAttachment(
        target,
        revisionId,
        attachment.id,
        changes,
      )
      replaceAttachment(updated)
      setPendingChanges((current) => {
        const next = { ...current }
        delete next[attachment.id]
        return next
      })
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDetach() {
    if (!removingAttachment) {
      return
    }
    setBusy(true)
    setError('')
    try {
      await detachAttachment(target, revisionId, removingAttachment.id)
      onAttachmentsChange(
        attachments.filter(
          (attachment) => attachment.id !== removingAttachment.id,
        ),
      )
      setRemovingAttachment(null)
    } catch (requestError) {
      setError(messageFor(requestError))
    } finally {
      setBusy(false)
    }
  }

  function updateChange(
    attachment: MediaAttachment,
    change: UpdateAttachmentPayload,
  ) {
    setPendingChanges((current) => ({
      ...current,
      [attachment.id]: {
        ...current[attachment.id],
        ...change,
      },
    }))
  }

  function updateMetadata(
    event: ChangeEvent<HTMLInputElement>,
    field: keyof MediaUploadMetadata,
  ) {
    setUploadMetadata((current) => ({
      ...current,
      [field]: event.target.value,
    }))
  }

  return (
    <section
      aria-labelledby="media-attachments-heading"
      className="mt-8 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            className="text-lg font-bold text-brand-navy"
            id="media-attachments-heading"
          >
            Media attachments
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {editable
              ? 'Uploads are private until the draft that references them is published.'
              : 'These files are attached to this revision.'}
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {editable && (
        <form
          className="mt-5 grid gap-4 rounded-lg bg-slate-50 p-4 sm:grid-cols-2"
          onSubmit={(event) => void handleUpload(event)}
        >
          <label className="text-sm font-medium text-slate-700">
            File
            <input
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              disabled={busy}
              ref={fileInput}
              type="file"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Attachment role
            <select
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              disabled={busy || roles.length === 0}
              onChange={(event) =>
                setRole(event.target.value as AttachmentRole)
              }
              value={role}
            >
              {roles.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            Media title (optional)
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              disabled={busy}
              maxLength={200}
              onChange={(event) => updateMetadata(event, 'title')}
              value={uploadMetadata.title ?? ''}
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Alternative text (optional)
            <input
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              disabled={busy}
              maxLength={500}
              onChange={(event) => updateMetadata(event, 'alt_text')}
              value={uploadMetadata.alt_text ?? ''}
            />
          </label>
          <p className="text-xs leading-5 text-slate-500 sm:col-span-2">
            Accepted formats: JPEG, PNG, WebP, MP4, WebM. The server enforces
            configured size and image-dimension limits (defaults: 12 MiB for
            images and 100 MiB for video).
          </p>
          {uploading && (
            <div className="text-sm text-slate-600 sm:col-span-2" role="status">
              <span>Uploading media…</span>
              <progress
                aria-label="Media upload in progress"
                className="mt-2 block h-2 w-full accent-brand-blue"
              />
            </div>
          )}
          <div className="sm:col-span-2">
            <button
              className="rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue disabled:opacity-60"
              disabled={busy || roles.length === 0}
              type="submit"
            >
              {uploading ? 'Uploading…' : 'Upload and attach'}
            </button>
          </div>
        </form>
      )}

      {pendingAsset && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            <span className="font-semibold">{pendingAsset.display_filename}</span>{' '}
            is uploaded but not attached.
          </p>
          <button
            className="rounded-lg border border-amber-700 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
            disabled={busy}
            onClick={() => void attachUploadedAsset(pendingAsset)}
            type="button"
          >
            Retry attachment
          </button>
        </div>
      )}

      {attachments.length === 0 ? (
        <p className="mt-5 text-sm text-slate-500">No media is attached.</p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-200">
          {attachments.map((attachment) => {
            const changes = pendingChanges[attachment.id] ?? {}
            const displayedRole = changes.role ?? attachment.role
            const displayedOrder =
              changes.display_order ?? attachment.display_order
            const displayedCaption =
              changes.caption_override ?? attachment.caption_override
            const displayedAlt =
              changes.alt_text_override ?? attachment.alt_text_override
            const title =
              attachment.asset.title ||
              attachment.asset.display_filename ||
              attachment.asset.original_filename

            return (
              <li
                className="grid gap-4 py-5 sm:grid-cols-[8rem_minmax(0,1fr)]"
                key={attachment.id}
              >
                {attachment.asset.media_type === 'image' ? (
                  <img
                    alt={
                      displayedAlt ||
                      attachment.asset.alt_text ||
                      title
                    }
                    className="aspect-video w-full rounded-lg bg-slate-100 object-cover"
                    src={assetPreviewUrl(attachment.asset)}
                  />
                ) : (
                  <video
                    aria-label={title}
                    className="aspect-video w-full rounded-lg bg-slate-100 object-cover"
                    controls
                    preload="metadata"
                    src={attachment.asset.content_url}
                  />
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-navy">{title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {attachment.asset.media_type} ·{' '}
                    {Math.ceil(attachment.asset.file_size / (1024 * 1024))} MiB
                  </p>
                  {editable ? (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-slate-600">
                        Role
                        <select
                          className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-sm"
                          disabled={busy}
                          onChange={(event) =>
                            updateChange(attachment, {
                              role: event.target.value as AttachmentRole,
                            })
                          }
                          value={displayedRole}
                        >
                          {roles.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        Display order
                        <input
                          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
                          disabled={busy}
                          max={32767}
                          min={0}
                          onChange={(event) =>
                            updateChange(attachment, {
                              display_order: Number(event.target.value),
                            })
                          }
                          type="number"
                          value={displayedOrder}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        Caption override
                        <input
                          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
                          disabled={busy}
                          maxLength={500}
                          onChange={(event) =>
                            updateChange(attachment, {
                              caption_override: event.target.value,
                            })
                          }
                          value={displayedCaption}
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-600">
                        Alternative text override
                        <input
                          className="mt-1 block w-full rounded border border-slate-300 p-2 text-sm"
                          disabled={busy}
                          maxLength={500}
                          onChange={(event) =>
                            updateChange(attachment, {
                              alt_text_override: event.target.value,
                            })
                          }
                          value={displayedAlt}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2 sm:col-span-2">
                        <button
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-60"
                          disabled={busy || !pendingChanges[attachment.id]}
                          onClick={() => void saveAttachment(attachment)}
                          type="button"
                        >
                          Save attachment
                        </button>
                        <button
                          className="rounded-lg px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
                          onClick={() => setRemovingAttachment(attachment)}
                          type="button"
                        >
                          Detach
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-600">
                      {attachment.caption_override || attachment.asset.caption}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {removingAttachment && (
        <ConfirmDialog
          confirmLabel="Detach media"
          description="This removes the media from this draft only. It does not delete the media file."
          onCancel={() => setRemovingAttachment(null)}
          onConfirm={() => void confirmDetach()}
          title="Detach this media?"
          busy={busy}
        />
      )}
    </section>
  )
}
