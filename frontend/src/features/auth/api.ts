export type UserRole = 'owner' | 'content_manager' | 'technical_admin' | string

export interface AuthenticatedUser {
  id: number
  email: string
  first_name: string
  last_name: string
  role: UserRole
}

export type ApiErrorKind = 'http' | 'network' | 'invalid-json'

export class SessionApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null

  constructor(
    message: string,
    kind: ApiErrorKind,
    status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'SessionApiError'
    this.kind = kind
    this.status = status
  }
}

let csrfToken: string | null = null

export function clearCsrfToken(): void {
  csrfToken = null
}

export async function getCsrfTokenForRequest(): Promise<string> {
  return csrfToken ?? fetchCsrfToken()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(payload: unknown, fallback: string): string {
  if (!isRecord(payload)) {
    return fallback
  }

  if (typeof payload.detail === 'string') {
    return payload.detail
  }

  for (const value of Object.values(payload)) {
    if (typeof value === 'string') {
      return value
    }
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0]
    }
  }

  return fallback
}

async function responseError(response: Response, fallback: string) {
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (response.status === 429) {
    return new SessionApiError(
      'Too many sign-in attempts. Please wait a minute and try again.',
      'http',
      response.status,
    )
  }

  if (response.status === 403) {
    return new SessionApiError(
      'The request could not be verified. Refresh the page and try again.',
      'http',
      response.status,
    )
  }

  if (response.status >= 500) {
    return new SessionApiError(
      'The server is temporarily unavailable. Please try again.',
      'http',
      response.status,
    )
  }

  return new SessionApiError(
    getErrorMessage(payload, fallback),
    'http',
    response.status,
  )
}

async function fetchResponse(
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

async function parseJson<T>(response: Response): Promise<T> {
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

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.email === 'string' &&
    typeof value.first_name === 'string' &&
    typeof value.last_name === 'string' &&
    typeof value.role === 'string'
  )
}

async function parseUserResponse(response: Response): Promise<AuthenticatedUser> {
  if (!response.ok) {
    throw await responseError(response, 'Authentication failed.')
  }

  const user = await parseJson<unknown>(response)
  if (!isAuthenticatedUser(user)) {
    throw new SessionApiError(
      'The server returned an invalid user profile.',
      'invalid-json',
      response.status,
    )
  }
  return user
}

export async function fetchCsrfToken(): Promise<string> {
  const response = await fetchResponse('/api/v1/auth/csrf/', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    throw await responseError(response, 'Could not initialize secure sign-in.')
  }

  const payload = await parseJson<unknown>(response)
  if (!isRecord(payload) || typeof payload.csrfToken !== 'string') {
    throw new SessionApiError(
      'The server returned an invalid CSRF token.',
      'invalid-json',
      response.status,
    )
  }

  csrfToken = payload.csrfToken
  return csrfToken
}

export async function restoreSession(): Promise<AuthenticatedUser | null> {
  const response = await fetchResponse('/api/v1/auth/me/', {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })

  if (response.status === 403) {
    clearCsrfToken()
    return null
  }

  const user = await parseUserResponse(response)
  await fetchCsrfToken()
  return user
}

export async function loginWithSession(
  email: string,
  password: string,
): Promise<AuthenticatedUser> {
  const token = await fetchCsrfToken()
  const response = await fetchResponse('/api/v1/auth/login/', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': token,
    },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  })

  const user = await parseUserResponse(response)
  await fetchCsrfToken()
  return user
}

async function sendLogout(token: string): Promise<Response> {
  return fetchResponse('/api/v1/auth/logout/', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'X-CSRFToken': token,
    },
    credentials: 'include',
  })
}

export async function logoutWithSession(): Promise<void> {
  let token = csrfToken ?? (await fetchCsrfToken())
  let response = await sendLogout(token)

  if (response.status === 403) {
    token = await fetchCsrfToken()
    response = await sendLogout(token)
  }

  if (!response.ok) {
    throw await responseError(response, 'Could not sign out. Please try again.')
  }
  clearCsrfToken()
}
