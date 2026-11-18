import { managementRequest } from '../auth/managementClient'
import type {
  ManagementService,
  RevisionMetadata,
} from '../cms/types'
import type { ProjectExecutionStatus } from '../../lib/api/types'

export type ProjectAvailability = 'enabled' | 'disabled' | 'archived'

export interface ProjectFields {
  title: string
  summary: string
  description: string
  category: number | null
  location: string
  country: string
  start_date: string | null
  completion_date: string | null
  execution_status: ProjectExecutionStatus
  project_background: string
  engineering_challenge: string
  proposed_solution: string
  work_carried_out: string
  technical_specifications: string
  outcomes: string
  related_services: number[]
  tags: number[]
  display_order: number
  is_featured: boolean
  client_name: string
  show_client_name: boolean
  seo_title: string
  seo_description: string
}

export interface ProjectRevision extends ProjectFields, RevisionMetadata {
  slug: string
}

export interface ProjectManagementRecord {
  id: number
  slug: string
  availability: ProjectAvailability
  archived_at: string | null
  created_by: number
  updated_by: number
  created_at: string
  updated_at: string
  draft: ProjectRevision | null
  published: ProjectRevision | null
}

export interface ProjectCategory {
  id: number
  name: string
  slug: string
  description: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectTag {
  id: number
  name: string
  slug: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectCategoryFields {
  name: string
  slug?: string
  description: string
  display_order: number
}

export interface ProjectTagFields {
  name: string
  slug?: string
}

export interface CreateProjectPayload extends ProjectFields {
  slug: string
}

const PROJECTS_PATH = '/api/v1/manage/projects/'
const CATEGORIES_PATH = '/api/v1/manage/project-categories/'
const TAGS_PATH = '/api/v1/manage/project-tags/'

function projectPath(slug: string): string {
  return `${PROJECTS_PATH}${encodeURIComponent(slug)}/`
}

export function listProjects(): Promise<ProjectManagementRecord[]> {
  return managementRequest(PROJECTS_PATH)
}

export function listManagementServices(): Promise<ManagementService[]> {
  return managementRequest('/api/v1/manage/services/')
}

export function createProject(
  payload: CreateProjectPayload,
): Promise<ProjectManagementRecord> {
  return managementRequest(PROJECTS_PATH, {
    method: 'POST',
    body: payload,
  })
}

export function getProjectDraft(slug: string): Promise<ProjectRevision> {
  return managementRequest(`${projectPath(slug)}draft/`)
}

export function createProjectDraft(slug: string): Promise<ProjectRevision> {
  return managementRequest(`${projectPath(slug)}draft/`, {
    method: 'POST',
  })
}

export function updateProjectDraft(
  slug: string,
  fields: ProjectFields,
): Promise<ProjectRevision> {
  return managementRequest(`${projectPath(slug)}draft/`, {
    method: 'PATCH',
    body: fields,
  })
}

export function previewProjectDraft(slug: string): Promise<ProjectRevision> {
  return managementRequest(`${projectPath(slug)}preview/`)
}

export function publishProjectDraft(slug: string): Promise<ProjectRevision> {
  return managementRequest(`${projectPath(slug)}publish/`, {
    method: 'POST',
  })
}

export function discardProjectDraft(slug: string): Promise<void> {
  return managementRequest(`${projectPath(slug)}discard-draft/`, {
    method: 'POST',
  })
}

export function archiveProject(
  slug: string,
): Promise<ProjectManagementRecord> {
  return managementRequest(`${projectPath(slug)}archive/`, {
    method: 'POST',
  })
}

export function setProjectAvailability(
  slug: string,
  availability: 'enabled' | 'disabled',
): Promise<ProjectManagementRecord> {
  return managementRequest(`${projectPath(slug)}availability/`, {
    method: 'PATCH',
    body: { availability },
  })
}

export function listProjectRevisions(
  slug: string,
): Promise<ProjectRevision[]> {
  return managementRequest(`${projectPath(slug)}revisions/`)
}

export function restoreProjectRevision(
  slug: string,
  revisionId: number,
): Promise<ProjectRevision> {
  return managementRequest(
    `${projectPath(slug)}revisions/${revisionId}/restore/`,
    { method: 'POST' },
  )
}

export function listProjectCategories(): Promise<ProjectCategory[]> {
  return managementRequest(CATEGORIES_PATH)
}

export function createProjectCategory(
  fields: ProjectCategoryFields,
): Promise<ProjectCategory> {
  return managementRequest(CATEGORIES_PATH, {
    method: 'POST',
    body: fields,
  })
}

export function updateProjectCategory(
  slug: string,
  fields: Partial<ProjectCategoryFields> | { is_active: boolean },
): Promise<ProjectCategory> {
  return managementRequest(`${CATEGORIES_PATH}${encodeURIComponent(slug)}/`, {
    method: 'PATCH',
    body: fields,
  })
}

export function listProjectTags(): Promise<ProjectTag[]> {
  return managementRequest(TAGS_PATH)
}

export function createProjectTag(fields: ProjectTagFields): Promise<ProjectTag> {
  return managementRequest(TAGS_PATH, {
    method: 'POST',
    body: fields,
  })
}

export function updateProjectTag(
  slug: string,
  fields: Partial<ProjectTagFields> | { is_active: boolean },
): Promise<ProjectTag> {
  return managementRequest(`${TAGS_PATH}${encodeURIComponent(slug)}/`, {
    method: 'PATCH',
    body: fields,
  })
}
