import type { HomepageSectionType } from '../../lib/api/types'

export type RevisionStatus = 'draft' | 'published' | 'archived'

export interface RevisionMetadata {
  id: number
  status: RevisionStatus
  created_by: number
  updated_by: number
  published_by: number | null
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface CompanyProfileFields {
  name: string
  tagline: string
  description: string
  overview: string
  business_phone: string
  whatsapp_number: string
  business_email: string
  physical_address: string
  city: string
  country: string
  service_areas: string[]
  linkedin_url: string
  instagram_url: string
  facebook_url: string
  tiktok_url: string
  youtube_url: string
}

export interface CompanyProfileRevision
  extends CompanyProfileFields,
    RevisionMetadata {}

export interface HomepageSectionFields {
  section_type: HomepageSectionType
  heading: string
  body: string
  cta_label: string
  cta_destination: string
  is_visible: boolean
  display_order: number
  item_limit: number | null
  curated_services: number[]
  curated_projects: number[]
}

export interface HomepageSectionRevision
  extends HomepageSectionFields,
    RevisionMetadata {}

export type MediaType = 'image' | 'video'
export type MediaLifecycle = 'active' | 'archived'
export type AttachmentRole =
  | 'logo'
  | 'section_image'
  | 'hero_image'
  | 'hero_video'
  | 'section_video'

export interface MediaAsset {
  id: string
  original_filename: string
  display_filename: string
  uploader: number
  media_type: MediaType
  verified_mime_type: string
  file_extension: string
  file_size: number
  sha256: string
  width: number | null
  height: number | null
  duration_seconds: number | null
  processing_metadata: Record<string, unknown>
  title: string
  description: string
  alt_text: string
  caption: string
  credit: string
  accessibility_description: string
  lifecycle: MediaLifecycle
  archived_at: string | null
  archived_by: number | null
  created_at: string
  updated_at: string
  content_url: string
  thumbnail_url: string | null
}

export interface MediaAttachment {
  id: number
  asset: MediaAsset
  role: AttachmentRole
  display_order: number
  caption_override: string
  alt_text_override: string
  created_by: number
  created_at: string
}

export interface ManagementServiceRevision {
  status: RevisionStatus
  title: string
  is_enabled: boolean
  category: number | null
}

export interface ManagementService {
  id: number
  slug: string
  is_archived: boolean
  draft: ManagementServiceRevision | null
  published: ManagementServiceRevision | null
}

export interface ManagementProjectRevision {
  status: RevisionStatus
  title: string
  category: number | null
}

export interface ManagementProject {
  id: number
  slug: string
  availability: 'enabled' | 'disabled' | 'archived'
  draft: ManagementProjectRevision | null
  published: ManagementProjectRevision | null
}

export interface ManagementCategory {
  id: number
  is_active: boolean
}

export interface FeaturedOption {
  id: number
  label: string
}
