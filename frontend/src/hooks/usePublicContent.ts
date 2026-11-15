import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api/errors'

export type PublicContentState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: ApiError }

export function usePublicContent<T>(
  load: (signal: AbortSignal) => Promise<T>,
): PublicContentState<T> {
  const [state, setState] = useState<PublicContentState<T>>({
    status: 'loading',
  })

  useEffect(() => {
    const controller = new AbortController()

    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setState({ status: 'success', data })
        }
      })
      .catch((error: unknown) => {
        if (
          controller.signal.aborted ||
          (error instanceof ApiError && error.kind === 'aborted')
        ) {
          return
        }

        setState({
          status: 'error',
          error:
            error instanceof ApiError ? error : ApiError.network(error),
        })
      })

    return () => controller.abort()
  }, [load])

  return state
}
