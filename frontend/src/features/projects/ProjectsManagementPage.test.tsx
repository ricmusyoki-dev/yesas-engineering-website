import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import { AuthProvider } from '../auth/AuthProvider'
import { clearCsrfToken } from '../auth/api'
import type {
  ProjectCategory,
  ProjectManagementRecord,
  ProjectRevision,
  ProjectTag,
} from './managementApi'

const owner = {
  id: 4,
  email: 'owner@example.test',
  first_name: 'Site',
  last_name: 'Owner',
  role: 'owner',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function revision(
  status: ProjectRevision['status'],
  overrides: Partial<ProjectRevision> = {},
): ProjectRevision {
  return {
    id: 12,
    status,
    slug: 'bridge-project',
    title: 'Bridge project',
    summary: 'Bridge project summary',
    description: 'Bridge project description',
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
    client_name: '',
    show_client_name: false,
    seo_title: '',
    seo_description: '',
    created_by: 4,
    updated_by: 4,
    published_by: status === 'published' ? 4 : null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    published_at: status === 'published' ? '2026-01-01T10:00:00Z' : null,
    ...overrides,
  }
}

function record(
  draft: ProjectRevision | null,
  published: ProjectRevision | null,
  overrides: Partial<ProjectManagementRecord> = {},
): ProjectManagementRecord {
  return {
    id: 5,
    slug: 'bridge-project',
    availability: 'enabled',
    archived_at: null,
    created_by: 4,
    updated_by: 4,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    draft,
    published,
    ...overrides,
  }
}

function category(overrides: Partial<ProjectCategory> = {}): ProjectCategory {
  return {
    id: 3,
    name: 'Energy',
    slug: 'energy',
    description: '',
    display_order: 0,
    is_active: true,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

function tag(overrides: Partial<ProjectTag> = {}): ProjectTag {
  return {
    id: 7,
    name: 'Renewable',
    slug: 'renewable',
    is_active: true,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

function renderProjectsPage() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard/projects'],
  })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('Projects Management page', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('creates a project from the management-record response and retries media attachment without re-uploading', async () => {
    const user = userEvent.setup()
    const draft = revision('draft')
    const projectRecord = record(draft, null)
    const asset = {
      id: 'asset-1',
      original_filename: 'bridge.webp',
      display_filename: 'bridge.webp',
      uploader: 4,
      media_type: 'image',
      verified_mime_type: 'image/webp',
      file_extension: 'webp',
      file_size: 100,
      sha256: 'digest',
      width: 20,
      height: 20,
      duration_seconds: null,
      processing_metadata: {},
      title: 'Bridge image',
      description: '',
      alt_text: 'Bridge construction',
      caption: '',
      credit: '',
      accessibility_description: '',
      lifecycle: 'active',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
      content_url: '/api/v1/media/assets/asset-1/content/',
      thumbnail_url: '/api/v1/media/assets/asset-1/thumbnail/',
    }
    const attachment = {
      id: 14,
      asset,
      role: 'cover_image',
      display_order: 0,
      caption_override: '',
      alt_text_override: '',
      created_by: 4,
      created_at: '2026-01-01T10:00:00Z',
    }
    let projectCreated = false
    let published = false
    let uploadCount = 0
    let attachAttempts = 0
    let attachments: typeof attachment[] = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'projects-token' })
      }
      if (
        path === '/api/v1/manage/projects/' &&
        init?.method === 'POST'
      ) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          slug: 'bridge-project',
          title: 'Bridge project',
          summary: 'Bridge project summary',
          description: 'Bridge project description',
        })
        projectCreated = true
        return jsonResponse(projectRecord, 201)
      }
      if (path === '/api/v1/manage/projects/') {
        return jsonResponse(
          projectCreated
            ? [
                record(
                  published ? null : draft,
                  published ? { ...draft, status: 'published' } : null,
                ),
              ]
            : [],
        )
      }
      if (path === '/api/v1/manage/project-categories/') return jsonResponse([])
      if (path === '/api/v1/manage/project-tags/') return jsonResponse([])
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (
        path === '/api/v1/projects/?page=1&page_size=100'
      ) {
        return jsonResponse({
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      }
      if (path === '/api/v1/media/attachments/project_revision/12/') {
        if (init?.method === 'POST') {
          attachAttempts += 1
          expect(JSON.parse(String(init.body))).toEqual({
            asset: 'asset-1',
            role: 'cover_image',
            display_order: 0,
          })
          if (attachAttempts === 1) {
            return jsonResponse(
              { detail: 'Attachment temporarily unavailable.' },
              503,
            )
          }
          attachments = [attachment]
          return jsonResponse(attachment, 201)
        }
        return jsonResponse(attachments)
      }
      if (path === '/api/v1/media/assets/' && init?.method === 'POST') {
        uploadCount += 1
        expect(init.body).toBeInstanceOf(FormData)
        expect(new Headers(init.headers).has('Content-Type')).toBe(false)
        return jsonResponse(asset, 201)
      }
      if (path === '/api/v1/manage/projects/bridge-project/preview/') {
        return jsonResponse(draft)
      }
      if (path === '/api/v1/manage/projects/bridge-project/publish/') {
        expect(init?.method).toBe('POST')
        published = true
        return jsonResponse({ ...draft, status: 'published' })
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderProjectsPage()
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
    await user.click(
      screen.getAllByRole('button', { name: 'Create project' })[0]!,
    )
    await user.type(screen.getByLabelText('Project URL slug'), 'bridge-project')
    await user.type(screen.getByLabelText('Project title'), 'Bridge project')
    await user.type(
      screen.getByLabelText('Short summary'),
      'Bridge project summary',
    )
    await user.type(
      screen.getByLabelText('Full project description'),
      'Bridge project description',
    )
    await user.click(
      screen.getByRole('button', { name: 'Create project draft' }),
    )
    expect(await screen.findByText('Project draft created.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Bridge project' }))
      .toBeInTheDocument()

    const file = new File(['image'], 'bridge.webp', { type: 'image/webp' })
    await user.upload(screen.getByLabelText('File'), file)
    await user.click(screen.getByRole('button', { name: 'Upload and attach' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'retry attachment without uploading it again',
    )
    await user.click(screen.getByRole('button', { name: 'Retry attachment' }))
    expect(await screen.findByText('Bridge image')).toBeInTheDocument()
    expect(uploadCount).toBe(1)
    expect(attachAttempts).toBe(2)

    expect(screen.getByRole('button', { name: 'Preview draft' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Preview draft' }))
    expect(
      await screen.findByRole('dialog', { name: 'Bridge project' }),
    ).toHaveTextContent('Bridge project description')
    expect(
      within(screen.getByRole('dialog', { name: 'Bridge project' })).getByRole(
        'img',
        { name: 'Bridge construction' },
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Publish project draft?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Publish project' }),
    )
    expect(await screen.findByText('Project “bridge-project” published.'))
      .toBeInTheDocument()
    expect(published).toBe(true)
  }, 10_000)

  it('requires confirmation before archiving a project and explains there is no unarchive API', async () => {
    const user = userEvent.setup()
    const published = revision('published')
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'projects-token' })
      }
      if (path === '/api/v1/manage/projects/') {
        if (init?.method === 'POST') {
          return jsonResponse(
            record(null, published, { availability: 'archived' }),
          )
        }
        return jsonResponse([record(null, published)])
      }
      if (path === '/api/v1/manage/project-categories/') return jsonResponse([])
      if (path === '/api/v1/manage/project-tags/') return jsonResponse([])
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (path === '/api/v1/projects/?page=1&page_size=100') {
        return jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [],
        })
      }
      if (
        path === '/api/v1/manage/projects/bridge-project/archive/' &&
        init?.method === 'POST'
      ) {
        return jsonResponse(
          record(null, published, { availability: 'archived' }),
        )
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderProjectsPage()
    await user.click(await screen.findByRole('button', { name: 'Archive' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Archive project permanently?',
    })
    expect(dialog).toHaveTextContent('backend has no unarchive operation')
    await user.click(
      within(dialog).getByRole('button', { name: 'Archive project' }),
    )
    expect(await screen.findByText('Project “bridge-project” archived.'))
      .toBeInTheDocument()
  })

  it('restores an archived revision as a draft without publishing it', async () => {
    const user = userEvent.setup()
    const published = revision('published')
    const archived = revision('archived', {
      id: 8,
      title: 'Previous bridge design',
    })
    const restored = revision('draft', {
      id: 15,
      title: 'Previous bridge design',
    })
    let hasDraft = false
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'projects-token' })
      }
      if (path === '/api/v1/manage/projects/') {
        return jsonResponse([record(hasDraft ? restored : null, published)])
      }
      if (path === '/api/v1/manage/project-categories/') return jsonResponse([])
      if (path === '/api/v1/manage/project-tags/') return jsonResponse([])
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (path === '/api/v1/projects/?page=1&page_size=100') {
        return jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [],
        })
      }
      if (path === '/api/v1/manage/projects/bridge-project/revisions/') {
        return jsonResponse([published, archived])
      }
      if (
        path ===
          '/api/v1/manage/projects/bridge-project/revisions/8/restore/' &&
        init?.method === 'POST'
      ) {
        hasDraft = true
        return jsonResponse(restored, 201)
      }
      if (path === '/api/v1/media/attachments/project_revision/15/') {
        return jsonResponse([])
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderProjectsPage()
    await user.click(
      await screen.findByRole('button', { name: 'Revision history' }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Restore as draft' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Restore archived revision?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Restore as draft' }),
    )

    expect(
      await screen.findByText('Archived revision restored as a new draft.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Project title')).toHaveValue(
      'Previous bridge design',
    )
    expect(
      screen.getByText('Currently live: Bridge project'),
    ).toBeInTheDocument()
  })

  it('edits a published project through a new draft and keeps the published revision unchanged until publication', async () => {
    const user = userEvent.setup()
    const published = revision('published')
    const draft = revision('draft', { id: 13 })
    const editedDraft = revision('draft', {
    id: 13,
    title: 'Updated bridge project',
    })
    let activeDraft: ProjectRevision | null = null
    let isPublished = false
    fetchMock.mockImplementation(async (input, init) => {
    const path = String(input)
    if (path === '/api/v1/auth/me/') return jsonResponse(owner)
    if (path === '/api/v1/auth/csrf/') {
      return jsonResponse({ csrfToken: 'projects-token' })
    }
    if (
      path === '/api/v1/manage/projects/bridge-project/draft/' &&
      init?.method === 'POST'
    ) {
      activeDraft = draft
      return jsonResponse(draft, 201)
    }
    if (
      path === '/api/v1/manage/projects/bridge-project/draft/' &&
      init?.method === 'PATCH'
    ) {
      expect(JSON.parse(String(init.body))).toMatchObject({
        title: 'Updated bridge project',
      })
      activeDraft = editedDraft
      return jsonResponse(editedDraft)
    }
    if (
      path === '/api/v1/manage/projects/bridge-project/publish/' &&
      init?.method === 'POST'
    ) {
      isPublished = true
      activeDraft = null
      return jsonResponse({ ...editedDraft, status: 'published' })
    }
    if (path === '/api/v1/manage/projects/') {
      return jsonResponse([
        record(
          activeDraft,
          isPublished ? { ...editedDraft, status: 'published' } : published,
        ),
      ])
    }
    if (path === '/api/v1/manage/project-categories/') return jsonResponse([])
    if (path === '/api/v1/manage/project-tags/') return jsonResponse([])
    if (path === '/api/v1/manage/services/') return jsonResponse([])
    if (path === '/api/v1/projects/?page=1&page_size=100') {
      return jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [],
      })
    }
    if (path === '/api/v1/media/attachments/project_revision/13/') {
      return jsonResponse([])
    }
    throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderProjectsPage()
    await user.click(await screen.findByRole('button', { name: 'Edit as draft' }))
    expect(await screen.findByLabelText('Project title')).toHaveValue(
    'Bridge project',
    )
    await user.clear(screen.getByLabelText('Project title'))
    await user.type(
    screen.getByLabelText('Project title'),
    'Updated bridge project',
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Project draft saved.')).toBeInTheDocument()
    expect(
    screen.getByText('Currently live: Bridge project'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = screen.getByRole('dialog', {
    name: 'Publish project draft?',
    })
    await user.click(
    within(dialog).getByRole('button', { name: 'Publish project' }),
    )
    expect(await screen.findByText('Project “bridge-project” published.'))
    .toBeInTheDocument()
    expect(isPublished).toBe(true)
  })

  it('creates project categories and tags and confirms immediate category deactivation', async () => {
    const user = userEvent.setup()
    const initialCategory = category()
    let categories = [initialCategory]
    let tags: ProjectTag[] = []
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'projects-token' })
      }
      if (path === '/api/v1/manage/projects/') return jsonResponse([])
      if (path === '/api/v1/manage/project-categories/') {
        if (init?.method === 'POST') {
          const created = category({ id: 4, name: 'Infrastructure' })
          categories = [...categories, created]
          return jsonResponse(created, 201)
        }
        return jsonResponse(categories)
      }
      if (path === '/api/v1/manage/project-tags/') {
        if (init?.method === 'POST') {
          const created = tag({ id: 8, name: 'Low carbon' })
          tags = [...tags, created]
          return jsonResponse(created, 201)
        }
        return jsonResponse(tags)
      }
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (path === '/api/v1/projects/?page=1&page_size=100') {
        return jsonResponse({
          count: 0,
          next: null,
          previous: null,
          results: [],
        })
      }
      if (
        path === '/api/v1/manage/project-categories/energy/' &&
        init?.method === 'PATCH'
      ) {
        expect(JSON.parse(String(init.body))).toEqual({ is_active: false })
        categories = categories.map((item) =>
          item.id === initialCategory.id
            ? category({ ...item, is_active: false })
            : item,
        )
        return jsonResponse(categories[0])
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderProjectsPage()
    await screen.findByRole('heading', { name: 'Project categories and tags' })
    await user.click(screen.getByText('Create category', { selector: 'summary' }))
    await user.type(screen.getByLabelText('Category name'), 'Infrastructure')
    await user.click(screen.getByRole('button', { name: 'Create category' }))
    expect(await screen.findByText('Project category created.'))
      .toBeInTheDocument()
    expect(screen.getByText('Infrastructure', { selector: 'p' }))
      .toBeInTheDocument()

    await user.click(screen.getByText('Create tag', { selector: 'summary' }))
    await user.type(screen.getByLabelText('Tag name'), 'Low carbon')
    await user.click(screen.getByRole('button', { name: 'Create tag' }))
    expect(await screen.findByText('Project tag created.'))
      .toBeInTheDocument()
    expect(screen.getByText('Low carbon', { selector: 'p' }))
      .toBeInTheDocument()

    const energyRow = screen.getByText('Energy', { selector: 'p' }).closest('li')
    expect(energyRow).not.toBeNull()
    await user.click(
      within(energyRow!).getByRole('button', { name: 'Deactivate' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Deactivate project category?',
    })
    expect(dialog).toHaveTextContent('immediately hides published projects')
    await user.click(
      within(dialog).getByRole('button', {
        name: 'Deactivate category',
      }),
    )
    expect(await screen.findByText('Category deactivated.'))
      .toBeInTheDocument()
  })
})
