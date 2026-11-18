import { managementRequest } from '../auth/managementClient'
import type {
  AttachmentRole,
  MediaAsset,
  MediaAttachment,
} from './types'

export type AttachmentTarget =
  | 'company_profile_revision'
  | 'homepage_section_revision'
  | 'service_revision'

export interface MediaUploadMetadata {
  title?: string
  description?: string
  alt_text?: string
  caption?: string
  credit?: string
  accessibility_description?: string
}

export interface CreateAttachmentPayload {
  asset: string
  role: AttachmentRole
  display_order: number
  caption_override?: string
  alt_text_override?: string
}

export interface UpdateAttachmentPayload {
  role?: AttachmentRole
  display_order?: number
  caption_override?: string
  alt_text_override?: string
}

function attachmentCollectionPath(
  target: AttachmentTarget,
  revisionId: number,
): string {
  return `/api/v1/media/attachments/${target}/${revisionId}/`
}

export function listAttachments(
  target: AttachmentTarget,
  revisionId: number,
): Promise<MediaAttachment[]> {
  return managementRequest(attachmentCollectionPath(target, revisionId))
}

export function uploadAsset(
  file: File,
  metadata: MediaUploadMetadata,
): Promise<MediaAsset> {
  const formData = new FormData()
  formData.append('file', file)

  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      formData.append(key, value)
    }
  }

  return managementRequest('/api/v1/media/assets/', {
    method: 'POST',
    body: formData,
  })
}

export function createAttachment(
  target: AttachmentTarget,
  revisionId: number,
  payload: CreateAttachmentPayload,
): Promise<MediaAttachment> {
  return managementRequest(attachmentCollectionPath(target, revisionId), {
    method: 'POST',
    body: payload,
  })
}

export function updateAttachment(
  target: AttachmentTarget,
  revisionId: number,
  attachmentId: number,
  changes: UpdateAttachmentPayload,
): Promise<MediaAttachment> {
  return managementRequest(
    `${attachmentCollectionPath(target, revisionId)}${attachmentId}/`,
    {
      method: 'PATCH',
      body: changes,
    },
  )
}

export function detachAttachment(
  target: AttachmentTarget,
  revisionId: number,
  attachmentId: number,
): Promise<void> {
  return managementRequest(
    `${attachmentCollectionPath(target, revisionId)}${attachmentId}/`,
    { method: 'DELETE' },
  )
}
