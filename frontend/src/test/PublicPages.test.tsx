import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyProfile, HomepageContent } from '../lib/api/types'
import { ApiError } from '../lib/api/errors'
import { makeCompanyProfile, makeHomepageSection, makeMedia, makeProject, makeService } from './fixtures'
import { AboutPage } from '../pages/AboutPage'
import { HomePage } from '../pages/HomePage'

const { getCompanyProfileMock, getHomepageContentMock } = vi.hoisted(() => ({
  getCompanyProfileMock: vi.fn<
    (signal?: AbortSignal) => Promise<CompanyProfile>
  >(),
  getHomepageContentMock: vi.fn<
    (signal?: AbortSignal) => Promise<HomepageContent>
  >(),
}))

vi.mock('../features/company/api', () => ({
  getCompanyProfile: getCompanyProfileMock,
  getHomepageContent: getHomepageContentMock,
}))

function renderPage(page: React.ReactNode) {
  return render(<MemoryRouter>{page}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('homepage CMS content', () => {
  it('shows a loading state while the public homepage request is pending', () => {
    getHomepageContentMock.mockReturnValue(new Promise(() => {}))
    renderPage(<HomePage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading published homepage content',
    )
  })

  it('orders visible sections and renders published hero, service, project and CTA content', async () => {
    const heroMedia = makeMedia({
      id: 'hero-photo',
      content_url: '/api/v1/media/assets/hero-photo/content/',
      alt_text: 'Published hero photograph',
    })
    const service = makeService({
      slug: 'published-service',
      title: 'Published service',
      summary: 'Service summary from the CMS.',
      category: { name: 'Electrical', slug: 'electrical' },
      cover_image: makeMedia({ id: 'service-cover' }),
    })
    const project = makeProject({
      slug: 'published-project',
      title: 'Published project',
      summary: 'Project summary from the CMS.',
      location: 'Published location',
      client_name: 'Approved client',
    })
    getHomepageContentMock.mockResolvedValue({
      sections: [
        makeHomepageSection({
          section_type: 'CONTACT_CTA',
          heading: 'Published contact heading',
          body: 'Published contact text.',
          cta_label: 'Contact the company',
          cta_destination: '/contact',
          display_order: 4,
        }),
        makeHomepageSection({
          section_type: 'FEATURED_PROJECTS',
          heading: 'Published projects',
          featured_projects: [project],
          display_order: 3,
        }),
        makeHomepageSection({
          section_type: 'FEATURED_SERVICES',
          heading: 'Published services',
          featured_services: [service],
          display_order: 2,
        }),
        makeHomepageSection({
          section_type: 'INTRODUCTION',
          heading: 'Published introduction',
          body: 'Published introduction copy.',
          display_order: 1,
        }),
        makeHomepageSection({
          section_type: 'HERO',
          heading: 'Published hero heading',
          body: 'Published hero supporting text.',
          hero_image: heroMedia,
          display_order: 0,
        }),
        makeHomepageSection({
          section_type: 'INTRODUCTION',
          heading: 'Hidden section',
          is_visible: false,
          display_order: 5,
        }),
      ],
    })

    const { container } = renderPage(<HomePage />)

    expect(
      await screen.findByRole('heading', { name: 'Published hero heading' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Published hero photograph' }),
    ).toHaveAttribute('src', heroMedia.content_url)
    expect(screen.getByText('Service summary from the CMS.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Published service' }),
    ).toHaveAttribute('href', '/services/published-service')
    expect(
      screen.getByRole('link', { name: 'Published project' }),
    ).toHaveAttribute('href', '/projects/published-project')
    expect(screen.getByText('Approved client')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Contact the company' }),
    ).toHaveAttribute('href', '/contact')
    expect(screen.queryByText('Hidden section')).not.toBeInTheDocument()

    const sectionOrder = Array.from(
      container.querySelectorAll<HTMLElement>('[data-homepage-section]'),
    ).map((section) => section.dataset.homepageSection)
    expect(sectionOrder).toEqual([
      'HERO',
      'INTRODUCTION',
      'FEATURED_SERVICES',
      'FEATURED_PROJECTS',
      'CONTACT_CTA',
    ])

    const servicesHeading = screen.getByRole('heading', {
      name: 'Published services',
    })
    expect(servicesHeading.closest('section')).toHaveClass('bg-slate-50')
    expect(servicesHeading).toHaveClass('text-brand-navy')

    const projectsHeading = screen.getByRole('heading', {
      name: 'Published projects',
    })
    expect(projectsHeading.closest('section')).toHaveClass('bg-brand-navy')
    expect(projectsHeading).toHaveClass('text-white')

    const contactHeading = screen.getByRole('heading', {
      name: 'Published contact heading',
    })
    expect(contactHeading).toHaveClass('text-white')
  })

  it('uses the technical fallback when a published hero has no media', async () => {
    getHomepageContentMock.mockResolvedValue({
      sections: [
        makeHomepageSection({
          section_type: 'HERO',
          heading: 'Published text-only hero',
          display_order: 0,
        }),
      ],
    })

    const { container } = renderPage(<HomePage />)

    expect(
      await screen.findByRole('heading', { name: 'Published text-only hero' }),
    ).toBeInTheDocument()
    expect(container.querySelector('.hero-technical-grid')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('keeps hero content usable when its image fails and no CTA is configured', async () => {
    getHomepageContentMock.mockResolvedValue({
      sections: [
        makeHomepageSection({
          section_type: 'HERO',
          heading: 'Published resilient hero',
          body: 'Published supporting text.',
          hero_image: makeMedia({ id: 'unavailable-hero-image' }),
        }),
      ],
    })

    renderPage(<HomePage />)

    expect(
      await screen.findByRole('heading', { name: 'Published resilient hero' }),
    ).toBeInTheDocument()
    fireEvent.error(screen.getByRole('img', { name: 'Test media alt text' }))
    expect(screen.getByRole('status')).toHaveTextContent('Media unavailable.')
    expect(screen.getByText('Published supporting text.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /contact|learn more/i }))
      .not.toBeInTheDocument()
  })

  it('renders an empty state instead of sample content when there are no sections', async () => {
    getHomepageContentMock.mockResolvedValue({ sections: [] })
    renderPage(<HomePage />)

    expect(
      await screen.findByText('There is no published homepage content available.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/sample|example/i)).not.toBeInTheDocument()
  })

  it('shows a visitor-safe error when the homepage API fails', async () => {
    getHomepageContentMock.mockRejectedValue(
      ApiError.http(500, 'Internal Server Error'),
    )
    renderPage(<HomePage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Homepage content is temporarily unavailable.',
    )
    expect(screen.queryByText('Internal Server Error')).not.toBeInTheDocument()
  })

  it('aborts the homepage request when the page unmounts', () => {
    let requestSignal: AbortSignal | undefined
    getHomepageContentMock.mockImplementation(
      (signal) =>
        new Promise((_resolve, reject) => {
          requestSignal = signal
          signal?.addEventListener(
            'abort',
            () => reject(ApiError.aborted(new Error('cancelled'))),
            { once: true },
          )
        }),
    )

    const { unmount } = renderPage(<HomePage />)
    unmount()

    expect(requestSignal?.aborted).toBe(true)
  })
})

describe('About page company profile', () => {
  it('shows a loading state while the company profile request is pending', () => {
    getCompanyProfileMock.mockReturnValue(new Promise(() => {}))
    renderPage(<AboutPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading published company information',
    )
  })

  it('renders published profile fields, media, service areas and validated contact links', async () => {
    const logo = makeMedia({
      id: 'company-logo',
      content_url: '/api/v1/media/assets/company-logo/content/',
      alt_text: 'Published company logo',
    })
    const companyImage = makeMedia({
      id: 'company-image',
      content_url: '/api/v1/media/assets/company-image/content/',
      alt_text: 'Published company image',
      caption: 'Published image caption',
      credit: 'Published image credit',
    })
    getCompanyProfileMock.mockResolvedValue(
      makeCompanyProfile({
        name: 'Published Engineering Company',
        tagline: 'Published tagline.',
        description: 'Published company description.',
        overview: 'Published company overview.',
        business_phone: '+254 (700) 123-456',
        whatsapp_number: '+254 700 123 456',
        business_email: 'contact@example.com',
        physical_address: 'Published address',
        city: 'Published city',
        country: 'Published country',
        service_areas: ['Published area one', 'Published area two'],
        linkedin_url: 'https://www.linkedin.com/company/example',
        logo,
        images: [companyImage],
      }),
    )

    renderPage(<AboutPage />)

    expect(
      await screen.findByRole('heading', {
        name: 'Published Engineering Company',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Published tagline.')).toBeInTheDocument()
    expect(screen.getByText('Published company description.')).toBeInTheDocument()
    expect(screen.getByText('Published company overview.')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Published company logo' }),
    ).toHaveAttribute('src', logo.content_url)
    expect(
      screen.getByRole('img', { name: 'Published company image' }),
    ).toHaveAttribute('src', companyImage.content_url)
    const figures = screen.getAllByRole('figure')
    expect(figures[1]).toHaveTextContent('Published image caption')
    expect(figures[1]).toHaveTextContent('Published image credit')
    expect(screen.getByText('Published area one')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '+254 (700) 123-456' }),
    ).toHaveAttribute('href', 'tel:+254700123456')
    expect(
      screen.getByRole('link', { name: 'contact@example.com' }),
    ).toHaveAttribute('href', 'mailto:contact@example.com')

    const whatsapp = screen.getByRole('link', {
      name: 'WhatsApp: +254 700 123 456',
    })
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/254700123456')
    expect(whatsapp).toHaveAttribute('target', '_blank')
    expect(
      screen.getByRole('link', { name: 'LinkedIn' }),
    ).toHaveAttribute('href', 'https://www.linkedin.com/company/example')
    await waitFor(() => {
      expect(document.title).toBe(
        'Published Engineering Company | About | Yesas Engineering',
      )
    })
    expect(
      document
        .querySelector('meta[name="description"]')
        ?.getAttribute('content'),
    ).toBe('Published company description.')
  })

  it('omits empty optional company fields and sections', async () => {
    getCompanyProfileMock.mockResolvedValue(
      makeCompanyProfile({
        name: '',
        tagline: '',
        description: '',
        overview: '',
        service_areas: [],
        images: [],
      }),
    )
    renderPage(<AboutPage />)

    expect(
      await screen.findByRole('heading', { name: 'YESAS ENGINEERING' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Company overview' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Service areas' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Contact information' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /telephone|email|whatsapp/i })).toBeNull()
  })

  it('shows a not-found state when no company profile is published', async () => {
    getCompanyProfileMock.mockRejectedValue(ApiError.http(404, 'Not Found'))
    renderPage(<AboutPage />)

    expect(
      await screen.findByRole('heading', { name: 'Company profile unavailable' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument()
  })

  it('shows a visitor-safe error for a company profile server error', async () => {
    getCompanyProfileMock.mockRejectedValue(
      ApiError.http(500, 'Internal Server Error'),
    )
    renderPage(<AboutPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Company information is temporarily unavailable.',
    )
    expect(screen.queryByText('Internal Server Error')).not.toBeInTheDocument()
  })
})
