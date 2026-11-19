import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PublicService } from '../lib/api/types'
import { makeCompanyProfile, makeMedia, makeService } from '../test/fixtures'
import { ContactPage } from './ContactPage'
import { ServiceDetailPage } from './ServiceDetailPage'
import { ServicesPage } from './ServicesPage'

const {
  getCompanyProfileMock,
  getServiceMock,
  listServicesMock,
} = vi.hoisted(() => ({
  getCompanyProfileMock: vi.fn(),
  getServiceMock: vi.fn(),
  listServicesMock: vi.fn(),
}))

vi.mock('../features/company/api', () => ({
  getCompanyProfile: getCompanyProfileMock,
}))

vi.mock('../features/services/api', () => ({
  getService: getServiceMock,
  listServices: listServicesMock,
}))

function renderPage(page: React.ReactNode, path = '/') {
  return render(<MemoryRouter initialEntries={[path]}>{page}</MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('published public services', () => {
  it('renders ordered services and their supplied media from the public API', async () => {
    const later = makeService({
      slug: 'later',
      title: 'Later service',
      display_order: 2,
    })
    const first = makeService({
      slug: 'first',
      title: 'First service',
      summary: 'CMS-provided service summary.',
      display_order: 1,
      cover_image: makeMedia({
        content_url: '/api/v1/media/assets/public-service/content/',
        alt_text: 'Public service image',
      }),
    })
    listServicesMock.mockResolvedValue([later, first] satisfies PublicService[])

    const { container } = renderPage(<ServicesPage />)

    expect(await screen.findByRole('heading', { name: 'First service' }))
      .toBeInTheDocument()
    expect(screen.getByText('CMS-provided service summary.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Public service image' }))
      .toHaveAttribute(
        'src',
        '/api/v1/media/assets/public-service/content/',
      )
    expect(
      Array.from(container.querySelectorAll('h2')).map(
        (heading) => heading.textContent,
      ),
    ).toEqual(['First service', 'Later service'])
    expect(listServicesMock).toHaveBeenCalledWith({}, expect.any(AbortSignal))
  })

  it('renders published service details and supported CMS actions', async () => {
    getServiceMock.mockResolvedValue(
      makeService({
        slug: 'electrical',
        title: 'Electrical engineering',
        description: 'Published service details.',
        cta_label: 'Request information',
        cta_destination: '/contact',
      }),
    )

    renderPage(<ServiceDetailPage />, '/services/electrical')

    expect(
      await screen.findByRole('heading', { name: 'Electrical engineering' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Published service details.')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Request information' }),
    ).toHaveAttribute('href', '/contact')
  })
})

describe('published contact information', () => {
  it('uses configured contact details and does not invent missing fields', async () => {
    getCompanyProfileMock.mockResolvedValue(
      makeCompanyProfile({
        business_email: 'hello@example.com',
        whatsapp_number: '+254 700 123 456',
      }),
    )

    renderPage(<ContactPage />, '/contact')

    expect(
      await screen.findByRole('heading', { name: 'Ways to get in touch' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'hello@example.com' }),
    ).toHaveAttribute('href', 'mailto:hello@example.com')
    expect(
      screen.getByRole('link', { name: 'WhatsApp: +254 700 123 456' }),
    ).toHaveAttribute('href', 'https://wa.me/254700123456')
    expect(screen.queryByRole('link', { name: /fake|example phone/i }))
      .not.toBeInTheDocument()
  })

  it('shows a clear empty state if no contact details are published', async () => {
    getCompanyProfileMock.mockResolvedValue(makeCompanyProfile())

    renderPage(<ContactPage />, '/contact')

    expect(
      await screen.findByText(
        'Published contact information has not been provided.',
      ),
    ).toBeInTheDocument()
  })
})
