import { managementRequest } from '../auth/managementClient'
import type {
  AttachmentRole,
  MediaAsset,
  MediaAttachment,
} from './types'

export interface PaginatedMediaAssets {
  count: number
  next: string | null
  previous: string | null
  results: MediaAsset[]
}

export interface MediaAssetFilters {
  page?: number
  page_size?: number
  search?: string
  media_type?: 'image' | 'video'
  lifecycle?: 'active' | 'archived'
  uploaded_by?: number
  ordering?: 'created_at' | '-created_at' | 'title' | '-title' | 'file_size' | '-file_size'
}

export type AttachmentTarget =
  | 'company_profile_revision'
  | 'homepage_section_revision'
  | 'service_revision'
  | 'project_revision'

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

export function listAssets(
  filters: MediaAssetFilters = {},
): Promise<PaginatedMediaAssets> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value))
    }
  }
  const query = params.toString()
  return managementRequest(`/api/v1/media/assets/${query ? `?${query}` : ''}`)
}

export function getAsset(assetId: string): Promise<MediaAsset> {
  return managementRequest(`/api/v1/media/assets/${assetId}/`)
}

export function updateAsset(
  assetId: string,
  changes: Partial<MediaUploadMetadata & { display_filename: string }>,
): Promise<MediaAsset> {
  return managementRequest(`/api/v1/media/assets/${assetId}/`, {
    method: 'PATCH',
    body: changes,
  })
}

export function archiveAsset(assetId: string): Promise<MediaAsset> {
  return managementRequest(`/api/v1/media/assets/${assetId}/archive/`, {
    method: 'POST',
  })
}

export function restoreAsset(assetId: string): Promise<MediaAsset> {
  return managementRequest(`/api/v1/media/assets/${assetId}/restore/`, {
    method: 'POST',
  })
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
