import { managementRequest } from '../auth/managementClient'
import type {
  CompanyProfileFields,
  CompanyProfileRevision,
} from '../cms/types'

const COMPANY_PATH = '/api/v1/manage/company/'
const DRAFT_PATH = `${COMPANY_PATH}draft/`

export function getCurrentCompanyProfile(): Promise<CompanyProfileRevision> {
  return managementRequest(COMPANY_PATH)
}

export function getCompanyProfileDraft(): Promise<CompanyProfileRevision> {
  return managementRequest(DRAFT_PATH)
}

export function createCompanyProfileDraft(
  fields: Partial<CompanyProfileFields> = {},
): Promise<CompanyProfileRevision> {
  return managementRequest(DRAFT_PATH, { method: 'POST', body: fields })
}

export function updateCompanyProfileDraft(
  fields: CompanyProfileFields,
): Promise<CompanyProfileRevision> {
  return managementRequest(DRAFT_PATH, { method: 'PATCH', body: fields })
}

export function previewCompanyProfileDraft(): Promise<CompanyProfileRevision> {
  return managementRequest(`${COMPANY_PATH}preview/`)
}

export function publishCompanyProfileDraft(): Promise<CompanyProfileRevision> {
  return managementRequest(`${DRAFT_PATH}publish/`, { method: 'POST' })
}

export function listCompanyProfileRevisions(): Promise<
  CompanyProfileRevision[]
> {
  return managementRequest(`${COMPANY_PATH}revisions/`)
}

export function restoreCompanyProfileRevision(
  revisionId: number,
): Promise<CompanyProfileRevision> {
  return managementRequest(
    `${COMPANY_PATH}revisions/${revisionId}/restore/`,
    { method: 'POST' },
  )
}
