import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import type { CompanyProfileRevision, MediaAsset } from '../cms/types'
import { AuthProvider } from '../auth/AuthProvider'
import { clearCsrfToken } from '../auth/api'

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

function companyRevision(
  status: CompanyProfileRevision['status'],
  overrides: Partial<CompanyProfileRevision> = {},
): CompanyProfileRevision {
  return {
    id: 17,
    status,
    name: 'Yesas Engineering',
    tagline: 'Configured tagline',
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
    created_by: 4,
    updated_by: 4,
    published_by: status === 'published' ? 4 : null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    published_at: status === 'published' ? '2026-01-01T10:00:00Z' : null,
    ...overrides,
  }
}

function renderCompanyPage() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard/company'],
  })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('Company Profile CMS page', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('creates a separate draft, saves it, and publishes only after confirmation', async () => {
    const user = userEvent.setup()
    const published = companyRevision('published')
    const draft = companyRevision('draft')
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'company-token' })
      }
      if (path === '/api/v1/manage/company/') return jsonResponse(published)
      if (path === '/api/v1/manage/company/revisions/') {
        return jsonResponse([published])
      }
      if (path === '/api/v1/manage/company/draft/' && init?.method === 'POST') {
        expect(init.body).toBe('{}')
        return jsonResponse(draft, 201)
      }
      if (path === '/api/v1/media/attachments/company_profile_revision/17/') {
        return jsonResponse([])
      }
      if (path === '/api/v1/manage/company/draft/' && init?.method === 'PATCH') {
        expect(JSON.parse(String(init.body))).toMatchObject({
          name: 'Yesas Engineering',
          tagline: 'Configured tagline',
          description: 'Reviewed profile text',
        })
        return jsonResponse({
          ...draft,
          description: 'Reviewed profile text',
          updated_at: '2026-01-02T10:00:00Z',
        })
      }
      if (path === '/api/v1/manage/company/preview/') {
        return jsonResponse({
          ...draft,
          description: 'Reviewed profile text',
        })
      }
      if (
        path === '/api/v1/manage/company/draft/publish/' &&
        init?.method === 'POST'
      ) {
        return jsonResponse(companyRevision('published', { description: 'Reviewed profile text' }))
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderCompanyPage()
    await screen.findByRole('button', { name: 'Edit as draft' })
    await user.click(screen.getByRole('button', { name: 'Edit as draft' }))

    const description = await screen.findByLabelText('Short description')
    expect(screen.getByLabelText('Company name')).toHaveValue('Yesas Engineering')
    expect(screen.getByLabelText('Tagline')).toHaveValue('Configured tagline')
    await user.type(description, 'Reviewed profile text')
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Company profile draft saved.',
      )
    })
    await user.click(screen.getByRole('button', { name: 'Preview draft' }))
    expect(
      await screen.findByRole('dialog', { name: 'Yesas Engineering' }),
    ).toHaveTextContent('Reviewed profile text')
    await user.click(screen.getByRole('button', { name: 'Close preview' }))

    await user.click(screen.getByRole('button', { name: 'Publish' }))
    expect(
      screen.getByRole('dialog', { name: 'Publish company profile?' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publish profile' }))
    expect(await screen.findByText('Company profile published.')).toBeInTheDocument()
    const publishRequest = fetchMock.mock.calls.find(
      ([path]) => path === '/api/v1/manage/company/draft/publish/',
    )
    expect(publishRequest?.[1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(
      new Headers(publishRequest?.[1]?.headers).get('X-CSRFToken'),
    ).toBe('company-token')
  })

  it('keeps an uploaded asset available for attachment retry without uploading twice', async () => {
    const user = userEvent.setup()
    const draft = companyRevision('draft')
    const asset: MediaAsset = {
      id: 'media-uuid',
      original_filename: 'logo.jpg',
      display_filename: 'logo.jpg',
      uploader: 4,
      media_type: 'image',
      verified_mime_type: 'image/jpeg',
      file_extension: 'jpg',
      file_size: 100,
      sha256: 'placeholder-hash',
      width: 10,
      height: 10,
      duration_seconds: null,
      processing_metadata: {},
      title: 'Logo',
      description: '',
      alt_text: 'Company logo',
      caption: '',
      credit: '',
      accessibility_description: '',
      lifecycle: 'active',
      archived_at: null,
      archived_by: null,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
      content_url: '/api/v1/media/assets/media-uuid/content/',
      thumbnail_url: '/api/v1/media/assets/media-uuid/content/?variant=thumbnail',
    }
    let attachmentAttempts = 0
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'media-token' })
      }
      if (path === '/api/v1/manage/company/') return jsonResponse(draft)
      if (path === '/api/v1/manage/company/revisions/') {
        return jsonResponse([draft])
      }
      if (path === '/api/v1/media/attachments/company_profile_revision/17/') {
        if (init?.method === 'POST') {
          attachmentAttempts += 1
          if (attachmentAttempts === 1) {
            return jsonResponse({ role: ['A logo is already attached.'] }, 400)
          }
          return jsonResponse(
            {
              id: 8,
              asset,
              role: 'logo',
              display_order: 0,
              caption_override: '',
              alt_text_override: '',
              created_by: 4,
              created_at: '2026-01-01T10:00:00Z',
            },
            201,
          )
        }
        return jsonResponse([])
      }
      if (path === '/api/v1/media/assets/' && init?.method === 'POST') {
        expect(init.body).toBeInstanceOf(FormData)
        const headers = new Headers(init.headers)
        expect(headers.has('Content-Type')).toBe(false)
        return jsonResponse(asset, 201)
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderCompanyPage()
    await screen.findByRole('heading', { name: 'Company Profile' })
    const file = new File(['image'], 'logo.jpg', { type: 'image/jpeg' })
    await user.upload(screen.getByLabelText('File'), file)
    await user.click(await screen.findByRole('button', { name: 'Upload and attach' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'role: A logo is already attached.',
    )
    await user.click(screen.getByRole('button', { name: 'Retry attachment' }))
    expect(await screen.findByText('Logo')).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.filter(([path]) => path === '/api/v1/media/assets/'),
    ).toHaveLength(1)
    expect(attachmentAttempts).toBe(2)
  })
})
