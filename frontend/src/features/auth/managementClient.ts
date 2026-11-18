import {
  clearCsrfToken,
  getCsrfTokenForRequest,
  SessionApiError,
} from './api'

type ManagementMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface ManagementRequestOptions {
  method?: ManagementMethod
  body?: unknown
  signal?: AbortSignal
}

const sessionExpiryListeners = new Set<() => void>()

export function onSessionExpired(listener: () => void): () => void {
  sessionExpiryListeners.add(listener)
  return () => {
    sessionExpiryListeners.delete(listener)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function formatValidationMessage(value: unknown): string | null {
  if (typeof value === 'string') {
    return value
  }
  if (Array.isArray(value)) {
    const messages = value
      .map(formatValidationMessage)
      .filter((message): message is string => message !== null)
    return messages.length > 0 ? messages.join(' ') : null
  }
  if (isRecord(value)) {
    const messages = Object.entries(value)
      .map(([field, detail]) => {
        const message = formatValidationMessage(detail)
        return message ? `${field}: ${message}` : null
      })
      .filter((message): message is string => message !== null)
    return messages.length > 0 ? messages.join(' ') : null
  }
  return null
}

async function responseError(response: Response): Promise<SessionApiError> {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  let message = 'The management request failed.'
  if (isRecord(payload) && typeof payload.detail === 'string') {
    message = payload.detail
  } else {
    message = formatValidationMessage(payload) ?? message
  }

  return new SessionApiError(message, 'http', response.status)
}

async function fetchManagementResponse(
  path: string,
  init: RequestInit,
): Promise<Response> {
  try {
    return await fetch(path, init)
  } catch (error) {
    throw new SessionApiError(
      'The server could not be reached. Check your connection and try again.',
      'network',
      null,
      { cause: error },
    )
  }
}

async function verifySessionAfterForbidden(): Promise<void> {
  const response = await fetchManagementResponse('/api/v1/auth/me/', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  if (response.status === 403) {
    clearCsrfToken()
    for (const listener of sessionExpiryListeners) {
      listener()
    }
    return
  }

  if (!response.ok) {
    throw await responseError(response)
  }
}

export async function managementRequest<T>(
  path: string,
  options: ManagementRequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET'
  const unsafe = method !== 'GET'
  const headers = new Headers({ Accept: 'application/json' })
  let body: BodyInit | undefined

  if (unsafe) {
    headers.set('X-CSRFToken', await getCsrfTokenForRequest())
  }

  if (
    typeof FormData !== 'undefined' &&
    options.body instanceof FormData
  ) {
    body = options.body
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  }

  const response = await fetchManagementResponse(path, {
    method,
    headers,
    credentials: 'include',
    body,
    signal: options.signal,
  })

  if (response.status === 403) {
    await verifySessionAfterForbidden()
  }

  if (!response.ok) {
    throw await responseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  try {
    return (await response.json()) as T
  } catch (error) {
    throw new SessionApiError(
      'The server returned an invalid response.',
      'invalid-json',
      response.status,
      { cause: error },
    )
  }
}
