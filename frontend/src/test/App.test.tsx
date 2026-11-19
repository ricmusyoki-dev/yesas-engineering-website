import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { appRoutes } from '../app/router'
import { Header } from '../components/Header'
import type {
  CompanyProfile,
  HomepageContent,
  PaginatedResponse,
  PublicProject,
  PublicService,
} from '../lib/api/types'
import { ApiError } from '../lib/api/errors'
import { makeCompanyProfile, makeService } from './fixtures'

const {
  getCompanyProfileMock,
  getHomepageContentMock,
  getProjectMock,
  listProjectsMock,
  getServiceMock,
  listServicesMock,
} = vi.hoisted(() => ({
  getCompanyProfileMock: vi.fn<() => Promise<CompanyProfile>>(),
  getHomepageContentMock: vi.fn<() => Promise<HomepageContent>>(),
  getProjectMock: vi.fn(),
  listProjectsMock: vi.fn(),
  getServiceMock: vi.fn(),
  listServicesMock: vi.fn(),
}))

vi.mock('../features/company/api', () => ({
  getCompanyProfile: getCompanyProfileMock,
  getHomepageContent: getHomepageContentMock,
}))

vi.mock('../features/projects/api', () => ({
  getProject: getProjectMock,
  listProjects: listProjectsMock,
}))

vi.mock('../features/services/api', () => ({
  getService: getServiceMock,
  listServices: listServicesMock,
}))

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  getCompanyProfileMock.mockResolvedValue(makeCompanyProfile())
  getHomepageContentMock.mockResolvedValue({ sections: [] })
  listProjectsMock.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  } satisfies PaginatedResponse<PublicProject>)
  getProjectMock.mockRejectedValue(ApiError.http(404, 'Not Found'))
  getServiceMock.mockRejectedValue(ApiError.http(404, 'Not Found'))
  listServicesMock.mockResolvedValue([] satisfies PublicService[])
})

describe('public application routes', () => {
  it('renders the home route in the shared public layout', async () => {
    renderRoute('/')

    expect(
      await screen.findByRole('heading', { name: 'Home' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Yesas Engineering')
  })

  it('renders the about route', async () => {
    renderRoute('/about')

    expect(
      await screen.findByRole('heading', { name: 'Test Engineering' }),
    ).toBeInTheDocument()
  })

  it('resets page metadata after navigating away from a CMS page', async () => {
    renderRoute('/about')

    await screen.findByRole('heading', { name: 'Test Engineering' })
    expect(document.title).toBe('Test Engineering | About | Yesas Engineering')

    fireEvent.click(screen.getByRole('link', { name: 'Services' }))
    await screen.findByText(
      'There are no published services available at this time.',
    )
    await waitFor(() => {
      expect(document.title).toBe('Services | Yesas Engineering')
    })
  })

  it('renders the services route', async () => {
    renderRoute('/services')

    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument()
    expect(
      await screen.findByText('There are no published services available at this time.'),
    ).toBeInTheDocument()
  })

  it('renders the projects route', () => {
    renderRoute('/projects')

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it.each([
    ['/projects/example-project', 'Project details'],
  ])('matches detail route %s', (path, heading) => {
    renderRoute(path)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('renders a published service detail route', async () => {
    getServiceMock.mockResolvedValue(makeService({ title: 'Published service' }))
    renderRoute('/services/example-service')

    expect(
      await screen.findByRole('heading', { name: 'Published service' }),
    ).toBeInTheDocument()
  })

  it('renders the contact route without a submission form', () => {
    renderRoute('/contact')

    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('renders privacy content as unavailable and omits it from navigation', () => {
    renderRoute('/privacy-policy')

    expect(
      screen.getByRole('heading', { name: 'Privacy policy' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/has not been supplied/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Privacy policy' }),
    ).not.toBeInTheDocument()
  })

  it('renders a not-found page for unknown paths', () => {
    renderRoute('/not-a-page')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('accessible responsive navigation', () => {
  it('exposes a labelled navigation and opens and closes its mobile menu', () => {
    render(
      <RouterProvider
        router={createMemoryRouter(
          [{ path: '*', element: <Header /> }],
          { initialEntries: ['/'] },
        )}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Privacy policy' })).toBeNull()

    const menuButton = screen.getByRole('button', {
      name: 'Open navigation menu',
    })
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Services' }))
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })
})
