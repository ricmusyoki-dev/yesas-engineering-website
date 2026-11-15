import { getJson } from '../../lib/api/client'
import type { PublicService } from '../../lib/api/types'

export interface ServiceListFilters {
  category?: string
}

export function listServices(
  filters: ServiceListFilters = {},
  signal?: AbortSignal,
): Promise<PublicService[]> {
  return getJson('/api/v1/services/', {
    query: { category: filters.category },
    signal,
  })
}

export function getService(
  slug: string,
  signal?: AbortSignal,
): Promise<PublicService> {
  return getJson(`/api/v1/services/${encodeURIComponent(slug)}/`, { signal })
}
