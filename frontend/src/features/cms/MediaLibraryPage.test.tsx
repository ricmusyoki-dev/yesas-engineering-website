import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import { AuthProvider } from '../auth/AuthProvider'
import { clearCsrfToken } from '../auth/api'
import type { MediaAsset } from './types'

const owner = {
  id: 4,
  email: 'owner@example.test',
  first_name: 'Site',
  last_name: 'Owner',
  role: 'owner',
}

function asset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    original_filename: 'engineering.jpg',
    display_filename: 'engineering.jpg',
    uploader: 4,
    media_type: 'image',
    verified_mime_type: 'image/jpeg',
    file_extension: 'jpg',
    file_size: 2048,
    sha256: 'a'.repeat(64),
    width: 1200,
    height: 800,
    duration_seconds: null,
    processing_metadata: {},
    title: 'Engineering plan',
    description: '',
    alt_text: 'A completed engineering plan',
    caption: '',
    credit: '',
    accessibility_description: '',
    lifecycle: 'active',
    archived_at: null,
    archived_by: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    content_url: '/api/v1/media/assets/550e8400-e29b-41d4-a716-446655440000/content/',
    thumbnail_url: '/api/v1/media/assets/550e8400-e29b-41d4-a716-446655440000/content/?variant=thumbnail',
    ...overrides,
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderLibrary() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard/media'],
  })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('Media Library CMS page', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('loads and lists assets with pagination information', async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') return jsonResponse({ csrfToken: 'token' })
      if (path.startsWith('/api/v1/media/assets/')) {
        return jsonResponse({
          count: 21,
          next: '/api/v1/media/assets/?page=2',
          previous: null,
          results: [asset()],
        })
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    renderLibrary()

    expect(await screen.findByText('Engineering plan')).toBeInTheDocument()
    expect(screen.getByText(/21 assets/)).toBeInTheDocument()
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('shows an empty state when the library has no matching assets', async () => {
    fetchMock.mockImplementation(async (input) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') return jsonResponse({ csrfToken: 'token' })
      if (path.startsWith('/api/v1/media/assets/')) {
        return jsonResponse({ count: 0, next: null, previous: null, results: [] })
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    renderLibrary()

    expect(await screen.findByText('No media found')).toBeInTheDocument()
  })

  it('archives an active asset and handles an archive conflict', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') return jsonResponse({ csrfToken: 'token' })
      if (path.startsWith('/api/v1/media/assets/') && init?.method !== 'POST') {
        return jsonResponse({
          count: 1,
          next: null,
          previous: null,
          results: [asset()],
        })
      }
      if (path.endsWith('/archive/') && init?.method === 'POST') {
        return jsonResponse(
          { detail: 'Remove the asset from all currently public content before archiving it.' },
          409,
        )
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderLibrary()
    await screen.findByRole('button', { name: 'Archive' })
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    await user.click(screen.getByRole('button', { name: 'Archive asset' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/public content/)
    })
  })
})
