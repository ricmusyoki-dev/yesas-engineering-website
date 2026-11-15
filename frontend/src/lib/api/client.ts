import { ApiError } from './errors'

export type QueryParameters = Readonly<
  Record<string, string | number | boolean | null | undefined>
>

export interface ApiRequestOptions {
  query?: QueryParameters
  signal?: AbortSignal
}

function appendQuery(
  path: string,
  query: QueryParameters | undefined,
): string {
  if (!query) {
    return path
  }

  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) {
      parameters.set(key, String(value))
    }
  }

  const serialized = parameters.toString()
  if (!serialized) {
    return path
  }

  return `${path}${path.includes('?') ? '&' : '?'}${serialized}`
}

export async function getJson<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  let response: Response

  try {
    response = await fetch(appendQuery(path, options.query), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      signal: options.signal,
    })
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof DOMException && error.name === 'AbortError')
    ) {
      throw ApiError.aborted(error)
    }
    throw ApiError.network(error)
  }

  if (!response.ok) {
    throw ApiError.http(response.status, response.statusText)
  }

  try {
    return await response.json()
  } catch (error) {
    if (options.signal?.aborted) {
      throw ApiError.aborted(error)
    }
    throw ApiError.invalidJson(error)
  }
}
