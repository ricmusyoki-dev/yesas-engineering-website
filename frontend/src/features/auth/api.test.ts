import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearCsrfToken,
  fetchCsrfToken,
  loginWithSession,
  logoutWithSession,
  restoreSession,
  SessionApiError,
} from './api'
import {
  managementRequest,
  onSessionExpired,
} from './managementClient'

const userProfile = {
  id: 7,
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

describe('session authentication API', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    clearCsrfToken()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    clearCsrfToken()
  })

  it('fetches a CSRF token before login and refreshes it after login', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'pre-login-token' }))
      .mockResolvedValueOnce(jsonResponse(userProfile))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'post-login-token' }))

    await expect(
      loginWithSession('owner@example.test', 'not-stored'),
    ).resolves.toEqual(userProfile)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/auth/csrf/',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/auth/login/',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRFToken': 'pre-login-token',
        },
        body: JSON.stringify({
          email: 'owner@example.test',
          password: 'not-stored',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/v1/auth/csrf/',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    )
  })

  it('treats an anonymous session restoration response as unauthenticated', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(restoreSession()).resolves.toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not convert session restoration network errors into logout', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))

    await expect(restoreSession()).rejects.toMatchObject({
      kind: 'network',
      status: null,
    })
  })

  it('sends logout with the current CSRF token and included credentials', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'logout-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await fetchCsrfToken()
    await expect(logoutWithSession()).resolves.toBeUndefined()

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/auth/logout/',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'X-CSRFToken': 'logout-token',
        },
      }),
    )
  })

  it('refreshes CSRF and retries logout once after a CSRF rejection', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'old-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'fresh-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))

    await fetchCsrfToken()
    await logoutWithSession()

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/v1/auth/logout/',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'X-CSRFToken': 'fresh-token',
        },
      }),
    )
  })

  it('includes credentials and CSRF on management mutations', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'management-token' }))
      .mockResolvedValueOnce(jsonResponse({ id: 11 }))

    await expect(
      managementRequest<{ id: number }>('/api/v1/manage/company/draft/', {
        method: 'PATCH',
        body: { description: 'Updated draft' },
      }),
    ).resolves.toEqual({ id: 11 })

    const [url, init] = fetchMock.mock.lastCall ?? []
    expect(url).toBe('/api/v1/manage/company/draft/')
    expect(init).toMatchObject({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ description: 'Updated draft' }),
    })
    const headers = new Headers(init?.headers)
    expect(headers.get('Accept')).toBe('application/json')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('X-CSRFToken')).toBe('management-token')
  })

  it('only treats a management 403 as session expiry if /auth/me also returns 403', async () => {
    const expiredListener = vi.fn()
    const unsubscribe = onSessionExpired(expiredListener)
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(jsonResponse(userProfile))

    await expect(
      managementRequest('/api/v1/manage/company/'),
    ).rejects.toMatchObject({ status: 403 })
    expect(expiredListener).not.toHaveBeenCalled()

    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))

    await expect(
      managementRequest('/api/v1/manage/company/'),
    ).rejects.toMatchObject({ status: 403 })
    expect(expiredListener).toHaveBeenCalledOnce()
    unsubscribe()
  })

  it('surfaces throttling and malformed responses as typed errors', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ csrfToken: 'attempt-token' }))
      .mockResolvedValueOnce(new Response(null, { status: 429 }))

    await expect(
      loginWithSession('owner@example.test', 'password'),
    ).rejects.toMatchObject({
      status: 429,
      message: 'Too many sign-in attempts. Please wait a minute and try again.',
    })

    fetchMock.mockResolvedValueOnce(new Response('{', { status: 200 }))
    await expect(fetchCsrfToken()).rejects.toBeInstanceOf(SessionApiError)
  })
})
