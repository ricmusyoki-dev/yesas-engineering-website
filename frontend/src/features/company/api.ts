import { getJson } from '../../lib/api/client'
import type { CompanyProfile, HomepageContent } from '../../lib/api/types'

export function getCompanyProfile(signal?: AbortSignal): Promise<CompanyProfile> {
  return getJson('/api/v1/company/', { signal })
}

export function getHomepageContent(
  signal?: AbortSignal,
): Promise<HomepageContent> {
  return getJson('/api/v1/homepage/', { signal })
}
