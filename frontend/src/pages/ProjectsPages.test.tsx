import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api/errors'
import type { PaginatedResponse, PublicProject } from '../lib/api/types'
import { makeMedia, makeProject, makeService } from '../test/fixtures'
import { ProjectDetailPage } from './ProjectDetailPage'
import { ProjectsPage } from './ProjectsPage'

const { getProjectMock, listProjectsMock } = vi.hoisted(() => ({
  getProjectMock: vi.fn(),
  listProjectsMock: vi.fn(),
}))

vi.mock('../features/projects/api', () => ({
  getProject: getProjectMock,
  listProjects: listProjectsMock,
}))

function renderProjects(path = '/projects') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:slug" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('public project pages', () => {
  it('renders published projects, media and applies URL-backed list filters', async () => {
    const user = userEvent.setup()
    const project = makeProject({
      slug: 'bridge-project',
      title: 'Bridge project',
      summary: 'A completed engineering project.',
      category: { name: 'Transport', slug: 'transport' },
      tags: [{ name: 'Bridge', slug: 'bridge' }],
      cover_image: makeMedia({
        id: 'bridge-cover',
        alt_text: 'Bridge cover photograph',
      }),
    })
    listProjectsMock.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [project],
    } satisfies PaginatedResponse<PublicProject>)

    renderProjects()

    expect(await screen.findByRole('heading', { name: 'Bridge project' }))
      .toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Bridge cover photograph' }),
    ).toBeInTheDocument()
    expect(screen.getByText('A completed engineering project.'))
      .toBeInTheDocument()
    expect(
      within(screen.getByRole('list', { name: 'Project tags' })).getByText(
        'Bridge',
      ),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Category'), 'transport')
    await waitFor(() => {
      expect(listProjectsMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'transport' }),
        expect.any(AbortSignal),
      )
    })
  })

  it('renders public project details and links related services', async () => {
    const project = makeProject({
      slug: 'bridge-project',
      title: 'Bridge project',
      description: 'Public project description.',
      engineering_challenge: 'A complex structural challenge.',
      client_name: 'Public client',
      cover_image: makeMedia({
        id: 'detail-cover',
        alt_text: 'Project cover',
      }),
      images: [makeMedia({ id: 'gallery-photo', alt_text: 'Gallery photo' })],
      videos: [
        makeMedia({
          id: 'project-video',
          media_type: 'video',
          content_type: 'video/mp4',
          alt_text: 'Project video',
        }),
      ],
      related_services: [
        makeService({ slug: 'structural-design', title: 'Structural design' }),
      ],
    })
    getProjectMock.mockResolvedValue(project)

    renderProjects('/projects/bridge-project')

    expect(
      await screen.findByRole('heading', { name: 'Bridge project' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Public project description.')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Engineering challenge' }),
    ).toBeInTheDocument()
    expect(screen.getByText('A complex structural challenge.'))
      .toBeInTheDocument()
    expect(screen.getByText('Public client')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Structural design' }),
    ).toHaveAttribute('href', '/services/structural-design')
    expect(
      screen.getByRole('img', { name: 'Gallery photo' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /All projects/ }),
    ).toHaveAttribute('href', '/projects')
  })

  it('shows a visitor-safe not-found state for unpublished project slugs', async () => {
    getProjectMock.mockRejectedValue(ApiError.http(404, 'Not Found'))
    renderProjects('/projects/not-published')

    expect(
      await screen.findByRole('heading', { name: 'Project not found' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This project is not available in the published portfolio.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Not Found')).not.toBeInTheDocument()
  })

  it('shows a retry option for public project list failures', async () => {
    listProjectsMock
      .mockRejectedValueOnce(ApiError.http(503, 'Unavailable'))
      .mockResolvedValueOnce({
        count: 0,
        next: null,
        previous: null,
        results: [],
      })
    renderProjects()

    expect(await screen.findByRole('heading', { name: 'Projects unavailable' }))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByText('There are no published projects yet.'),
    ).toBeInTheDocument()
  })
})
