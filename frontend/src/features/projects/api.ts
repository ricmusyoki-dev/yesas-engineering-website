import { getJson } from '../../lib/api/client'
import type {
  PaginatedResponse,
  ProjectListFilters,
  PublicProject,
} from '../../lib/api/types'

export function listProjects(
  filters: ProjectListFilters = {},
  signal?: AbortSignal,
): Promise<PaginatedResponse<PublicProject>> {
  return getJson('/api/v1/projects/', {
    query: {
      page: filters.page,
      page_size: filters.page_size,
      category: filters.category,
      tag: filters.tag,
      featured: filters.featured,
    },
    signal,
  })
}

export function getProject(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicProject> {
  return getJson(`/api/v1/projects/${encodeURIComponent(slug)}/`, { signal })
}
