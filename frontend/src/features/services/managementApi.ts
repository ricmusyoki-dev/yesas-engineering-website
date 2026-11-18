import { managementRequest } from '../auth/managementClient'
import type { RevisionMetadata } from '../cms/types'

export interface ServiceFields {
  title: string
  summary: string
  description: string
  category: number | null
  display_order: number
  is_enabled: boolean
  is_featured: boolean
  features: string[]
  benefits: string[]
  process: string
  cta_label: string
  cta_destination: string
  seo_title: string
  seo_description: string
}

export interface ServiceRevision extends ServiceFields, RevisionMetadata {
  slug: string
}

export interface ServiceManagementRecord {
  id: number
  slug: string
  is_archived: boolean
  archived_at: string | null
  created_by: number
  updated_by: number
  created_at: string
  updated_at: string
  draft: ServiceRevision | null
  published: ServiceRevision | null
}

export interface ServiceCategory {
  id: number
  name: string
  slug: string
  description: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ServiceCategoryFields {
  name: string
  slug?: string
  description: string
  display_order: number
}

export interface CreateServicePayload extends ServiceFields {
  slug: string
}

const SERVICES_PATH = '/api/v1/manage/services/'
const CATEGORIES_PATH = '/api/v1/manage/service-categories/'

function servicePath(slug: string): string {
  return `${SERVICES_PATH}${encodeURIComponent(slug)}/`
}

export function listServices(): Promise<ServiceManagementRecord[]> {
  return managementRequest(SERVICES_PATH)
}

export function createService(
  payload: CreateServicePayload,
): Promise<ServiceRevision> {
  return managementRequest(SERVICES_PATH, {
    method: 'POST',
    body: payload,
  })
}

export function getServiceDraft(slug: string): Promise<ServiceRevision> {
  return managementRequest(`${servicePath(slug)}draft/`)
}

export function createServiceDraft(slug: string): Promise<ServiceRevision> {
  return managementRequest(`${servicePath(slug)}draft/`, {
    method: 'POST',
  })
}

export function updateServiceDraft(
  slug: string,
  fields: ServiceFields,
): Promise<ServiceRevision> {
  return managementRequest(`${servicePath(slug)}draft/`, {
    method: 'PATCH',
    body: fields,
  })
}

export function previewServiceDraft(slug: string): Promise<ServiceRevision> {
  return managementRequest(`${servicePath(slug)}preview/`)
}

export function publishServiceDraft(slug: string): Promise<ServiceRevision> {
  return managementRequest(`${servicePath(slug)}publish/`, {
    method: 'POST',
  })
}

export function discardServiceDraft(slug: string): Promise<void> {
  return managementRequest(`${servicePath(slug)}discard-draft/`, {
    method: 'POST',
  })
}

export function archiveService(
  slug: string,
): Promise<ServiceManagementRecord> {
  return managementRequest(`${servicePath(slug)}archive/`, {
    method: 'POST',
  })
}

export function listServiceRevisions(
  slug: string,
): Promise<ServiceRevision[]> {
  return managementRequest(`${servicePath(slug)}revisions/`)
}

export function restoreServiceRevision(
  slug: string,
  revisionId: number,
): Promise<ServiceRevision> {
  return managementRequest(
    `${servicePath(slug)}revisions/${revisionId}/restore/`,
    { method: 'POST' },
  )
}

export function listServiceCategories(): Promise<ServiceCategory[]> {
  return managementRequest(CATEGORIES_PATH)
}

export function createServiceCategory(
  fields: ServiceCategoryFields,
): Promise<ServiceCategory> {
  return managementRequest(CATEGORIES_PATH, {
    method: 'POST',
    body: fields,
  })
}

export function updateServiceCategory(
  slug: string,
  fields: Partial<ServiceCategoryFields> | { is_active: boolean },
): Promise<ServiceCategory> {
  return managementRequest(
    `${CATEGORIES_PATH}${encodeURIComponent(slug)}/`,
    { method: 'PATCH', body: fields },
  )
}
