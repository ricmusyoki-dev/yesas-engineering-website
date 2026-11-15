import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listProjects } from '../../features/projects/api'
import { getJson } from './client'

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

describe('public API client', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses a successful JSON response and does not send session credentials', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ name: 'Yesas Engineering' }))

    await expect(getJson<{ name: string }>('/api/v1/company/')).resolves.toEqual({
      name: 'Yesas Engineering',
    })
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'omit',
    })
  })

  it.each([404, 500])('normalizes HTTP %s responses', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status }))

    await expect(getJson('/api/v1/company/')).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'http',
      status,
    })
  })

  it('normalizes network failures', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Network unavailable'))

    await expect(
      getJson('/api/v1/company/'),
    ).rejects.toMatchObject({
      name: 'ApiError',
      kind: 'network',
      status: null,
    })
  })

  it('reports malformed successful JSON responses', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(getJson('/api/v1/company/')).rejects.toMatchObject({
      kind: 'invalid-json',
      status: null,
    })
  })

  it('constructs project pagination and filter parameters with URLSearchParams', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ count: 0, next: null, previous: null, results: [] }),
    )

    await listProjects({
      page: 2,
      page_size: 25,
      category: 'industrial services',
      featured: false,
    })

    const requestUrl = String(fetchMock.mock.calls[0]?.[0])
    const queryString = requestUrl.split('?')[1] ?? ''
    const query = new URLSearchParams(queryString)
    expect(requestUrl).toContain('/api/v1/projects/')
    expect(query.get('page')).toBe('2')
    expect(query.get('page_size')).toBe('25')
    expect(query.get('category')).toBe('industrial services')
    expect(query.get('featured')).toBe('false')
  })

  it('supports request cancellation and normalizes abort errors', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Aborted', 'AbortError')),
            { once: true },
          )
        }),
    )

    const request = getJson('/api/v1/company/', { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toMatchObject({
      kind: 'aborted',
      status: null,
    })
  })
})
