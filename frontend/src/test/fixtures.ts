import type {
  CompanyProfile,
  HomepageSection,
  PublicMedia,
  PublicProject,
  PublicService,
} from '../lib/api/types'

export function makeMedia(
  overrides: Partial<PublicMedia> = {},
): PublicMedia {
  return {
    id: 'media-test-id',
    title: 'Test media',
    media_type: 'image',
    content_type: 'image/jpeg',
    content_url: '/api/v1/media/assets/media-test-id/content/',
    thumbnail_url: null,
    width: 1200,
    height: 800,
    duration_seconds: null,
    alt_text: 'Test media alt text',
    caption: '',
    credit: '',
    ...overrides,
  }
}

export function makeCompanyProfile(
  overrides: Partial<CompanyProfile> = {},
): CompanyProfile {
  return {
    name: 'Test Engineering',
    tagline: '',
    description: '',
    overview: '',
    business_phone: '',
    whatsapp_number: '',
    business_email: '',
    physical_address: '',
    city: '',
    country: '',
    service_areas: [],
    linkedin_url: '',
    instagram_url: '',
    facebook_url: '',
    tiktok_url: '',
    youtube_url: '',
    logo: null,
    images: [],
    ...overrides,
  }
}

export function makeService(
  overrides: Partial<PublicService> = {},
): PublicService {
  return {
    slug: 'test-service',
    title: 'Test service',
    summary: 'Test service summary.',
    description: 'Test service description.',
    category: null,
    display_order: 0,
    is_featured: false,
    features: [],
    benefits: [],
    process: '',
    cta_label: '',
    cta_destination: '',
    seo_title: '',
    seo_description: '',
    cover_image: null,
    images: [],
    videos: [],
    ...overrides,
  }
}

export function makeProject(
  overrides: Partial<PublicProject> = {},
): PublicProject {
  return {
    slug: 'test-project',
    title: 'Test project',
    summary: 'Test project summary.',
    description: 'Test project description.',
    category: null,
    location: '',
    country: '',
    start_date: null,
    completion_date: null,
    execution_status: '',
    project_background: '',
    engineering_challenge: '',
    proposed_solution: '',
    work_carried_out: '',
    technical_specifications: '',
    outcomes: '',
    related_services: [],
    tags: [],
    display_order: 0,
    is_featured: false,
    client_name: null,
    seo_title: '',
    seo_description: '',
    cover_image: null,
    images: [],
    videos: [],
    ...overrides,
  }
}

export function makeHomepageSection(
  overrides: Partial<HomepageSection> = {},
): HomepageSection {
  return {
    section_type: 'INTRODUCTION',
    heading: 'Test heading',
    body: '',
    cta_label: '',
    cta_destination: '',
    is_visible: true,
    display_order: 0,
    item_limit: null,
    featured_services: [],
    featured_projects: [],
    hero_image: null,
    hero_video: null,
    images: [],
    videos: [],
    ...overrides,
  }
}
