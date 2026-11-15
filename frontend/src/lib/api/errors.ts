export type ApiErrorKind = 'http' | 'network' | 'invalid-json' | 'aborted'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null

  constructor(
    kind: ApiErrorKind,
    message: string,
    status: number | null = null,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }

  static http(status: number, statusText: string): ApiError {
    return new ApiError(
      'http',
      statusText || `The request failed with status ${status}.`,
      status,
    )
  }

  static network(cause: unknown): ApiError {
    return new ApiError(
      'network',
      'The request could not be completed. Check your connection and try again.',
      null,
      { cause },
    )
  }

  static invalidJson(cause: unknown): ApiError {
    return new ApiError(
      'invalid-json',
      'The server returned an invalid response.',
      null,
      { cause },
    )
  }

  static aborted(cause: unknown): ApiError {
    return new ApiError('aborted', 'The request was cancelled.', null, {
      cause,
    })
  }
}
