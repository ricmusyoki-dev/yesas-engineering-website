export type MediaType = 'image' | 'video'

export interface PublicMedia {
  id: string
  title: string
  media_type: MediaType
  content_type: string
  content_url: string
  thumbnail_url: string | null
  width: number | null
  height: number | null
  duration_seconds: number | null
  alt_text: string
  caption: string
  credit: string
}

export interface CompanyProfile {
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
  logo: PublicMedia | null
  images: PublicMedia[]
}

export interface PublicCategory {
  name: string
  slug: string
}

export interface PublicService {
  slug: string
  title: string
  summary: string
  description: string
  category: PublicCategory | null
  display_order: number
  is_featured: boolean
  features: string[]
  benefits: string[]
  process: string
  cta_label: string
  cta_destination: string
  seo_title: string
  seo_description: string
  cover_image: PublicMedia | null
  images: PublicMedia[]
  videos: PublicMedia[]
}

export interface PublicProjectTag {
  name: string
  slug: string
}

export type ProjectExecutionStatus =
  | ''
  | 'planning'
  | 'in_progress'
  | 'completed'
  | 'on_hold'

export interface PublicProject {
  slug: string
  title: string
  summary: string
  description: string
  category: PublicCategory | null
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
  related_services: PublicService[]
  tags: PublicProjectTag[]
  display_order: number
  is_featured: boolean
  client_name: string | null
  seo_title: string
  seo_description: string
  cover_image: PublicMedia | null
  images: PublicMedia[]
  videos: PublicMedia[]
}

export type HomepageSectionType =
  | 'HERO'
  | 'INTRODUCTION'
  | 'FEATURED_SERVICES'
  | 'FEATURED_PROJECTS'
  | 'CONTACT_CTA'

export interface HomepageSection {
  section_type: HomepageSectionType
  heading: string
  body: string
  cta_label: string
  cta_destination: string
  is_visible: boolean
  display_order: number
  item_limit: number | null
  featured_services: PublicService[]
  featured_projects: PublicProject[]
  hero_image: PublicMedia | null
  hero_video: PublicMedia | null
  images: PublicMedia[]
  videos: PublicMedia[]
}

export interface HomepageContent {
  sections: HomepageSection[]
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ProjectListFilters {
  page?: number
  page_size?: number
  category?: string
  tag?: string
  featured?: boolean
}
