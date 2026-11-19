import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { appRoutes } from '../../app/router'
import { AuthProvider } from './AuthProvider'
import { clearCsrfToken } from './api'

const owner = {
  id: 4,
  email: 'owner@example.test',
  first_name: 'Site',
  last_name: 'Owner',
  role: 'owner',
}

const manager = {
  ...owner,
  role: 'content_manager',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return {
    router,
    ...render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    ),
  }
}

describe('private dashboard authentication flow', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('restores an authenticated owner session and displays the real name', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(owner))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'restored-token' }))

    renderAt('/dashboard')

    expect(
      await screen.findByRole('heading', { name: 'Welcome, Site Owner' }),
    ).toBeInTheDocument()
  })

  it('redirects an anonymous visitor to login and returns to the requested page', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'before-login' }))
      .mockResolvedValueOnce(jsonResponse(owner))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'after-login' }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(
        jsonResponse({ count: 0, next: null, previous: null, results: [] }),
      )

    renderAt('/dashboard/projects')

    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email address'), owner.email)
    await user.type(screen.getByLabelText('Password'), 'placeholder-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(
      await screen.findByRole('heading', { name: 'Projects Management' }),
    ).toBeInTheDocument()
    expect(await screen.findByText('No projects yet')).toBeInTheDocument()
  })

  it('does not expose dashboard content while session restoration is pending', async () => {
    let resolveSession: ((response: Response) => void) | undefined
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveSession = resolve
        }),
    )

    renderAt('/dashboard')

    expect(screen.getByRole('status')).toHaveTextContent('Checking your session')
    expect(
      screen.queryByRole('heading', { name: 'Welcome, Site Owner' }),
    ).not.toBeInTheDocument()

    resolveSession?.(new Response(null, { status: 403 }))
    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument()
  })

  it('shows a session error instead of treating a network failure as logout', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))

    renderAt('/dashboard')

    expect(
      await screen.findByRole('heading', { name: 'Dashboard unavailable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry session check' }))
      .toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Welcome back' }))
      .not.toBeInTheDocument()
  })

  it('denies content-manager roles without granting dashboard access', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(manager))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'manager-token' }))

    renderAt('/dashboard/company')

    expect(
      await screen.findByRole('heading', {
        name: 'This account cannot manage website content',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Dashboard navigation' }))
      .not.toBeInTheDocument()
  })

  it('validates empty login fields and toggles password visibility', async () => {
    const user = userEvent.setup()
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    renderAt('/dashboard/login')

    await screen.findByRole('heading', { name: 'Welcome back' })
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(
      screen.getByRole('alert'),
    ).toHaveTextContent('Enter both your email address and password.')

    const password = screen.getByLabelText('Password')
    expect(password).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('reports invalid credentials and throttling without losing the form', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'invalid-token' }))
      .mockResolvedValueOnce(
        jsonResponse({ detail: 'Invalid email or password.' }, 400),
      )

    renderAt('/dashboard/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    await user.type(screen.getByLabelText('Email address'), owner.email)
    await user.type(screen.getByLabelText('Password'), 'incorrect')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password.',
    )
    expect(screen.getByLabelText('Email address')).toHaveValue(owner.email)
  })

  it('explains login throttling in the sign-in form', async () => {
    const user = userEvent.setup()
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'rate-limit-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))

    renderAt('/dashboard/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    await user.type(screen.getByLabelText('Email address'), owner.email)
    await user.type(screen.getByLabelText('Password'), 'placeholder-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many sign-in attempts. Please wait a minute and try again.',
    )
  })

  it('logs out with CSRF, clears auth state, and returns to login', async () => {
    const user = userEvent.setup()
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input)
      if (path === '/api/v1/auth/me/') return jsonResponse(owner)
      if (path === '/api/v1/auth/csrf/') {
        return jsonResponse({ csrfToken: 'logout-csrf' })
      }
      if (path === '/api/v1/auth/logout/' && init?.method === 'POST') {
        return new Response(null, { status: 204 })
      }
      if (path === '/api/v1/manage/services/') return jsonResponse([])
      if (path === '/api/v1/manage/projects/') return jsonResponse([])
      if (path === '/api/v1/manage/homepage/sections/') return jsonResponse([])
      if (path.startsWith('/api/v1/media/assets/')) {
        return jsonResponse({ count: 0, next: null, previous: null, results: [] })
      }
      throw new Error(`Unexpected request: ${path}`)
    })

    renderAt('/dashboard')
    await screen.findByRole('heading', { name: 'Welcome, Site Owner' })
    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(
      await screen.findByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/auth/logout/',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-CSRFToken': 'logout-csrf',
        },
      }),
    )
  })

  it('allows public routes while the dashboard remains private', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    renderAt('/services')

    expect(
      await screen.findByRole('heading', { name: 'Services' }),
    ).toBeInTheDocument()
  })

  it('redirects authenticated owners away from the login page', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(owner))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'owner-token' }))

    renderAt('/dashboard/login')

    expect(
      await screen.findByRole('heading', { name: 'Welcome, Site Owner' }),
    ).toBeInTheDocument()
  })

  it('shows a loading state while login is in flight', async () => {
    const user = userEvent.setup()
    let resolveLogin: ((response: Response) => void) | undefined
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'before-login' }))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveLogin = resolve
          }),
      )

    renderAt('/dashboard/login')
    await screen.findByRole('heading', { name: 'Welcome back' })
    await user.type(screen.getByLabelText('Email address'), owner.email)
    await user.type(screen.getByLabelText('Password'), 'placeholder-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(screen.getByRole('button', { name: 'Signing in…' }))
      .toBeDisabled()
    resolveLogin?.(jsonResponse(owner))
    fetchMock.mockResolvedValueOnce(jsonResponse({ csrfToken: 'after-login' }))
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Welcome, Site Owner' }),
      ).toBeInTheDocument()
    })
  })
})
