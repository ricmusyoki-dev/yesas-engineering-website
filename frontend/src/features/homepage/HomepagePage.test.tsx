import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appRoutes } from '../../app/router'
import type { HomepageSectionRevision } from '../cms/types'
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

function section(
  status: HomepageSectionRevision['status'],
  overrides: Partial<HomepageSectionRevision> = {},
): HomepageSectionRevision {
  return {
    id: 12,
    status,
    section_type: 'INTRODUCTION',
    heading: 'Existing introduction',
    body: '',
    cta_label: '',
    cta_destination: '',
    is_visible: true,
    display_order: 1,
    item_limit: null,
    curated_services: [],
    curated_projects: [],
    created_by: 4,
    updated_by: 4,
    published_by: status === 'published' ? 4 : null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    published_at: status === 'published' ? '2026-01-01T10:00:00Z' : null,
    ...overrides,
  }
}

function renderHomepagePage() {
  const router = createMemoryRouter(appRoutes, {
    initialEntries: ['/dashboard/homepage'],
  })
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  )
}

describe('Homepage CMS page', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('creates and saves a section draft, then requires confirmation to publish', async () => {
    const user = userEvent.setup()
    const published = section('published')
    const draft = section('draft')
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'homepage-token' })
      }
      if (path === '/api/v1/manage/homepage/sections/') {
        if (init?.method === 'POST') {
          expect(JSON.parse(String(init.body))).toEqual({
            section_type: 'INTRODUCTION',
          })
          return jsonResponse(draft, 201)
        }
        return jsonResponse([published])
      }
      if (path === '/api/v1/manage/homepage/revisions/') {
        return jsonResponse([published])
      }
      if (
        path === '/api/v1/manage/homepage/sections/INTRODUCTION/draft/'
      ) {
        if (init?.method === 'PATCH') {
          expect(JSON.parse(String(init.body))).toMatchObject({
            section_type: 'INTRODUCTION',
            heading: 'Updated introduction',
            display_order: 0,
            is_visible: false,
          })
          return jsonResponse(
            section('draft', {
              heading: 'Updated introduction',
              display_order: 0,
              is_visible: false,
            }),
          )
        }
        return jsonResponse(draft)
      }
      if (
        path ===
        '/api/v1/media/attachments/homepage_section_revision/12/'
      ) {
        return jsonResponse([])
      }
      if (path === '/api/v1/manage/homepage/preview/') {
        return jsonResponse([
          section('draft', { heading: 'Updated introduction' }),
        ])
      }
      if (
        path ===
          '/api/v1/manage/homepage/sections/INTRODUCTION/draft/publish/' &&
        init?.method === 'POST'
      ) {
        return jsonResponse(section('published', { heading: 'Updated introduction' }))
      }
      throw new Error(`Unexpected request: ${path} ${init?.method ?? 'GET'}`)
    })

    renderHomepagePage()
    await screen.findByRole('button', { name: 'Edit as draft' })
    await user.click(screen.getByRole('button', { name: 'Edit as draft' }))

    const heading = await screen.findByLabelText('Heading')
    await user.clear(heading)
    await user.type(heading, 'Updated introduction')
    await user.clear(screen.getByLabelText('Display order'))
    await user.type(screen.getByLabelText('Display order'), '0')
    await user.click(
      screen.getByRole('checkbox', {
        name: 'Visible on the homepage when published',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Save draft' }))

    await waitFor(() => {
      expect(screen.getAllByRole('status').some((status) =>
        status.textContent?.includes('Introduction draft saved.'),
      )).toBe(true)
    })
    const editor = screen.getByRole('region', { name: 'Introduction' })
    await user.click(within(editor).getByRole('button', { name: 'Preview' }))
    expect(
      await screen.findByRole('dialog', { name: 'Introduction' }),
    ).toHaveTextContent('Updated introduction')
    await user.click(screen.getByRole('button', { name: 'Close preview' }))

    await user.click(screen.getByRole('button', { name: 'Publish section' }))
    expect(
      screen.getByRole('dialog', { name: 'Publish homepage section?' }),
    ).toBeInTheDocument()
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Publish homepage section?' }),
      ).getByRole('button', { name: 'Publish section' }),
    )
    expect(
      await screen.findByText('Introduction section published.'),
    ).toBeInTheDocument()
  })
})
