import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import { AuthProvider } from '../auth/AuthProvider'

const owner = {
  id: 4,
  email: 'owner@example.test',
  first_name: 'Site',
  last_name: 'Owner',
  role: 'owner',
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('Dashboard overview summary', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows real published, draft, and media counts', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(owner))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'overview-csrf' }))
      .mockResolvedValueOnce(jsonResponse([
        { id: 1, slug: 'design', is_archived: false, draft: null, published: { id: 1, status: 'published' } },
        { id: 2, slug: 'survey', is_archived: false, draft: { id: 2, status: 'draft' }, published: null },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 1, slug: 'bridge', availability: 'enabled', draft: null, published: { id: 1, status: 'published' } },
        { id: 2, slug: 'road', availability: 'disabled', draft: null, published: { id: 2, status: 'published' } },
      ]))
      .mockResolvedValueOnce(jsonResponse([
        { id: 1, section_type: 'HERO', status: 'published' },
        { id: 2, section_type: 'INTRODUCTION', status: 'draft' },
      ]))
      .mockResolvedValueOnce(jsonResponse({ count: 7, next: null, previous: null, results: [] }))

    const router = createMemoryRouter(appRoutes, {
      initialEntries: ['/dashboard'],
    })
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    )

    expect(await screen.findByText('Published services')).toBeInTheDocument()
    expect(screen.getByText('Published services').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Published projects').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByText('Draft updates').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Active media assets').nextElementSibling).toHaveTextContent('7')
  })
})
