import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import { AuthProvider } from '../auth/AuthProvider'
import { clearCsrfToken } from '../auth/api'
import type {
  ServiceCategory,
  ServiceManagementRecord,
  ServiceRevision,
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
  status: ServiceRevision['status'],
  overrides: Partial<ServiceRevision> = {},
): ServiceRevision {
  return {
    id: status === 'archived' ? 8 : 9,
    status,
    slug: 'design-service',
    title: 'Design service',
    summary: 'Design service summary',
    description: 'Design service description',
    category: null,
    display_order: 0,
    is_enabled: true,
    is_featured: false,
    features: [],
    benefits: [],
    process: '',
    cta_label: '',
    cta_destination: '',
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
  draft: ServiceRevision | null,
  published: ServiceRevision | null,
  overrides: Partial<ServiceManagementRecord> = {},
): ServiceManagementRecord {
  return {
    id: 5,
    slug: 'design-service',
    is_archived: false,
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

function category(overrides: Partial<ServiceCategory> = {}): ServiceCategory {
  return {
    id: 3,
    name: 'Design',
    slug: 'design',
    description: '',
    display_order: 0,
    is_active: true,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  }
}

function renderServicesPage() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard/services'],
  })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('Services Management page', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('shows an empty state and reports list errors with a retry option', async () => {
    let serviceListAvailable = false
    fetchMock.mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'services-token' })
      }
      if (path === '/api/v1/manage/services/') {
        return serviceListAvailable
          ? jsonResponse([])
          : jsonResponse({ detail: 'Service list unavailable.' }, 503)
      }
      if (path === '/api/v1/manage/service-categories/') return jsonResponse([])
      throw new Error(`Unexpected request: ${path}`)
    })

    renderServicesPage()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Service list unavailable.',
    )
    serviceListAvailable = true
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('No services yet')).toBeInTheDocument()
  })

  it('creates a draft, uploads and attaches media, previews it, then explicitly publishes', async () => {
    const user = userEvent.setup()
    const draft = revision('draft', {
      id: 12,
      title: 'New service',
      summary: 'New service summary',
      description: 'New service description',
      slug: 'new-service',
    })
    const draftRecord = record(draft, null, {
      slug: 'new-service',
    })
    const asset = {
      id: 'asset-1',
      original_filename: 'service.webp',
      display_filename: 'service.webp',
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
      title: 'Service image',
      description: '',
      alt_text: 'Service image',
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
    let published = false
    let attachments: typeof attachment[] = []

    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'services-token' })
      }
      if (
        path === '/api/v1/manage/services/' &&
        init?.method === 'POST'
      ) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          slug: 'new-service',
          title: 'New service',
        })
        return jsonResponse(draft, 201)
      }
      if (path === '/api/v1/manage/services/') {
        return jsonResponse(published ? [record(null, { ...draft, status: 'published' })] : attachments.length ? [draftRecord] : [])
      }
      if (path === '/api/v1/manage/service-categories/') return jsonResponse([])
      if (path === '/api/v1/media/attachments/service_revision/12/') {
        if (init?.method === 'POST') {
          expect(JSON.parse(String(init.body))).toEqual({
            asset: 'asset-1',
            role: 'cover_image',
            display_order: 0,
          })
          attachments = [attachment]
          return jsonResponse(attachment, 201)
        }
        return jsonResponse(attachments)
      }
      if (path === '/api/v1/media/assets/' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData)
        expect(new Headers(init.headers).has('Content-Type')).toBe(false)
        return jsonResponse(asset, 201)
      }
      if (path === '/api/v1/manage/services/new-service/preview/') {
        return jsonResponse(draft)
      }
      if (
        path === '/api/v1/manage/services/new-service/publish/' &&
        init?.method === 'POST'
      ) {
        published = true
        return jsonResponse({ ...draft, status: 'published' })
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderServicesPage()
    await screen.findByText('No services yet')
    await user.click(
      screen.getAllByRole('button', { name: 'Create service' })[0]!,
    )
    await user.type(screen.getByLabelText('Service URL slug'), 'new-service')
    await user.type(screen.getByLabelText('Service title'), 'New service')
    await user.type(screen.getByLabelText('Short summary'), 'New service summary')
    await user.type(
      screen.getByLabelText('Detailed description'),
      'New service description',
    )
    await user.click(
      screen.getByRole('button', { name: 'Create service draft' }),
    )
    expect(await screen.findByText('Service draft created.')).toBeInTheDocument()

    const file = new File(['image'], 'service.webp', { type: 'image/webp' })
    await user.upload(screen.getByLabelText('File'), file)
    await user.click(screen.getByRole('button', { name: 'Upload and attach' }))
    expect(await screen.findByText('Service image')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Preview draft' }))
    expect(
      await screen.findByRole('dialog', { name: 'New service' }),
    ).toHaveTextContent('New service description')
    await user.click(screen.getByRole('button', { name: 'Close preview' }))
    await user.click(screen.getByRole('button', { name: 'Publish' }))
    const dialog = screen.getByRole('dialog', {
      name: 'Publish service draft?',
    })
    await user.click(
      within(dialog).getByRole('button', { name: 'Publish service' }),
    )
    expect(await screen.findByText('Service “new-service” published.'))
      .toBeInTheDocument()
  })

  it('edits a published service through a draft and leaves the live revision unchanged', async () => {
    const user = userEvent.setup()
    const published = revision('published')
    let draft: ServiceRevision | null = null

    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'services-token' })
      }
      if (path === '/api/v1/manage/services/') {
        return jsonResponse([record(draft, published)])
      }
      if (path === '/api/v1/manage/service-categories/') return jsonResponse([])
      if (
        path === '/api/v1/manage/services/design-service/draft/' &&
        init?.method === 'POST'
      ) {
        draft = revision('draft', { id: 10 })
        return jsonResponse(draft, 201)
      }
      if (
        path === '/api/v1/manage/services/design-service/draft/' &&
        init?.method === 'PATCH'
      ) {
        expect(JSON.parse(String(init.body))).toMatchObject({
          title: 'Updated design service',
        })
        draft = revision('draft', { id: 10, title: 'Updated design service' })
        return jsonResponse(draft)
      }
      if (path === '/api/v1/media/attachments/service_revision/10/') {
        return jsonResponse([])
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderServicesPage()
    await user.click(
      await screen.findByRole('button', { name: 'Edit as draft' }),
    )
    expect(await screen.findByLabelText('Service title')).toHaveValue(
      'Design service',
    )
    await user.clear(screen.getByLabelText('Service title'))
    await user.type(
      screen.getByLabelText('Service title'),
      'Updated design service',
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    expect(await screen.findByText('Service draft saved.')).toBeInTheDocument()
    expect(screen.getByText('Live version remains unchanged')).toBeInTheDocument()
    expect(screen.getByText('Currently live: Design service')).toBeInTheDocument()
  })

  it('restores an archived revision as a draft without publishing it', async () => {
    const user = userEvent.setup()
    const published = revision('published')
    const archived = revision('archived', {
      id: 8,
      title: 'Previous design service',
    })
    const restored = revision('draft', {
      id: 15,
      title: archived.title,
    })
    let hasDraft = false

    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'services-token' })
      }
      if (path === '/api/v1/manage/services/') {
        return jsonResponse([record(hasDraft ? restored : null, published)])
      }
      if (path === '/api/v1/manage/service-categories/') return jsonResponse([])
      if (path === '/api/v1/manage/services/design-service/revisions/') {
        return jsonResponse([published, archived])
      }
      if (
        path ===
          '/api/v1/manage/services/design-service/revisions/8/restore/' &&
        init?.method === 'POST'
      ) {
        hasDraft = true
        return jsonResponse(restored, 201)
      }
      if (
        path === '/api/v1/media/attachments/service_revision/15/'
      ) {
        return jsonResponse([])
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderServicesPage()
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

    expect(await screen.findByText('Archived revision restored as a new draft.'))
      .toBeInTheDocument()
    expect(screen.getByLabelText('Service title')).toHaveValue(
      'Previous design service',
    )
    expect(screen.getByText('Currently live: Design service')).toBeInTheDocument()
  })

  it('requires confirmation before immediate category deactivation', async () => {
    const user = userEvent.setup()
    let activeCategory = category()
    let categories = [activeCategory]

    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'services-token' })
      }
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (path === '/api/v1/manage/service-categories/') {
        if (init?.method === 'POST') {
          const created = category({ id: 4, name: 'New category' })
          categories = [...categories, created]
          return jsonResponse(created, 201)
        }
        return jsonResponse(categories)
      }
      if (
        path === '/api/v1/manage/service-categories/design/' &&
        init?.method === 'PATCH'
      ) {
        expect(JSON.parse(String(init.body))).toEqual({ is_active: false })
        activeCategory = category({ is_active: false })
        categories = categories.map((item) =>
          item.id === activeCategory.id ? activeCategory : item,
        )
        return jsonResponse(activeCategory)
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderServicesPage()
    await screen.findByRole('heading', { name: 'Service categories' })
    await user.click(screen.getByText('Create category', { selector: 'summary' }))
    await user.type(screen.getByLabelText('Category name'), 'New category')
    await user.click(
      screen.getByRole('button', { name: 'Create category' }),
    )
    expect(await screen.findByText('Service category created.'))
      .toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'New category' }),
    ).toBeInTheDocument()

    const designCategory = screen
      .getByRole('heading', { name: 'Design' })
      .closest('li')
    expect(designCategory).not.toBeNull()
    await user.click(
      within(designCategory!).getByRole('button', { name: 'Deactivate' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Deactivate service category?',
    })
    expect(dialog).toHaveTextContent('immediately hides published services')
    await user.click(
      within(dialog).getByRole('button', { name: 'Deactivate category' }),
    )
    await waitFor(() => {
      expect(screen.getByText('Category deactivated. Public service visibility updates immediately.'))
        .toBeInTheDocument()
    })
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })
})
