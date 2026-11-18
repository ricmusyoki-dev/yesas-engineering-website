import { managementRequest } from '../auth/managementClient'
import type {
  FeaturedOption,
  HomepageSectionFields,
  HomepageSectionRevision,
  ManagementCategory,
  ManagementProject,
  ManagementService,
} from '../cms/types'

const HOMEPAGE_PATH = '/api/v1/manage/homepage/'
const SECTIONS_PATH = `${HOMEPAGE_PATH}sections/`

export const HOMEPAGE_SECTION_TYPES = [
  'HERO',
  'INTRODUCTION',
  'FEATURED_SERVICES',
  'FEATURED_PROJECTS',
  'CONTACT_CTA',
] as const

export function listHomepageSections(): Promise<HomepageSectionRevision[]> {
  return managementRequest(SECTIONS_PATH)
}

export function previewHomepage(): Promise<HomepageSectionRevision[]> {
  return managementRequest(`${HOMEPAGE_PATH}preview/`)
}

export function createHomepageSectionDraft(
  sectionType: HomepageSectionFields['section_type'],
): Promise<HomepageSectionRevision> {
  return managementRequest(SECTIONS_PATH, {
    method: 'POST',
    body: { section_type: sectionType },
  })
}

export function getHomepageSectionDraft(
  sectionType: HomepageSectionFields['section_type'],
): Promise<HomepageSectionRevision> {
  return managementRequest(
    `${SECTIONS_PATH}${encodeURIComponent(sectionType)}/draft/`,
  )
}

export function updateHomepageSectionDraft(
  sectionType: HomepageSectionFields['section_type'],
  fields: HomepageSectionFields,
): Promise<HomepageSectionRevision> {
  return managementRequest(
    `${SECTIONS_PATH}${encodeURIComponent(sectionType)}/draft/`,
    { method: 'PATCH', body: fields },
  )
}

export function publishHomepageSectionDraft(
  sectionType: HomepageSectionFields['section_type'],
): Promise<HomepageSectionRevision> {
  return managementRequest(
    `${SECTIONS_PATH}${encodeURIComponent(sectionType)}/draft/publish/`,
    { method: 'POST' },
  )
}

export function listHomepageRevisions(
  sectionType?: HomepageSectionFields['section_type'],
): Promise<HomepageSectionRevision[]> {
  const query = sectionType
    ? `?section_type=${encodeURIComponent(sectionType)}`
    : ''
  return managementRequest(`${HOMEPAGE_PATH}revisions/${query}`)
}

export function restoreHomepageRevision(
  revisionId: number,
): Promise<HomepageSectionRevision> {
  return managementRequest(`${HOMEPAGE_PATH}revisions/${revisionId}/restore/`, {
    method: 'POST',
  })
}

export async function listFeaturedServices(): Promise<FeaturedOption[]> {
  const [services, categories] = await Promise.all([
    managementRequest<ManagementService[]>('/api/v1/manage/services/'),
    managementRequest<ManagementCategory[]>(
      '/api/v1/manage/service-categories/',
    ),
  ])
  const categoryStatus = new Map(
    categories.map((category) => [category.id, category.is_active]),
  )

  return services
    .filter((service) => {
      const published = service.published
      return (
        !service.is_archived &&
        published?.status === 'published' &&
        published.is_enabled &&
        (published.category === null || categoryStatus.get(published.category))
      )
    })
    .map((service) => ({
      id: service.id,
      label: service.published?.title || service.slug,
    }))
}

export async function listFeaturedProjects(): Promise<FeaturedOption[]> {
  const [projects, categories] = await Promise.all([
    managementRequest<ManagementProject[]>('/api/v1/manage/projects/'),
    managementRequest<ManagementCategory[]>(
      '/api/v1/manage/project-categories/',
    ),
  ])
  const categoryStatus = new Map(
    categories.map((category) => [category.id, category.is_active]),
  )

  return projects
    .filter((project) => {
      const published = project.published
      return (
        project.availability === 'enabled' &&
        published?.status === 'published' &&
        (published.category === null || categoryStatus.get(published.category))
      )
    })
    .map((project) => ({
      id: project.id,
      label: project.published?.title || project.slug,
    }))
}
