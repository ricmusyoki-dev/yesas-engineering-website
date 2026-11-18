import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AuthContext, type AuthState } from './AuthContext'
import {
  clearCsrfToken,
  loginWithSession,
  logoutWithSession,
  restoreSession,
  SessionApiError,
} from './api'
import { onSessionExpired } from './managementClient'

function errorMessage(error: unknown): string {
  if (error instanceof SessionApiError) {
    return error.message
  }
  return 'The current session could not be restored. Check your connection and retry.'
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const restoreStarted = useRef(false)

  const retrySessionRestore = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const user = await restoreSession()
      setState(
        user
          ? { status: 'authenticated', user }
          : { status: 'unauthenticated' },
      )
    } catch (error) {
      setState({ status: 'error', message: errorMessage(error) })
    }
  }, [])

  useEffect(() => {
    if (restoreStarted.current) {
      return
    }
    restoreStarted.current = true
    void retrySessionRestore()
  }, [retrySessionRestore])

  useEffect(
    () =>
      onSessionExpired(() => {
        clearCsrfToken()
        setState({ status: 'unauthenticated' })
      }),
    [],
  )

  const login = useCallback(async (email: string, password: string) => {
    const user = await loginWithSession(email, password)
    setState({ status: 'authenticated', user })
  }, [])

  const logout = useCallback(async () => {
    try {
      await logoutWithSession()
      setState({ status: 'unauthenticated' })
    } catch (error) {
      if (error instanceof SessionApiError && error.status === 403) {
        try {
          const user = await restoreSession()
          if (!user) {
            clearCsrfToken()
            setState({ status: 'unauthenticated' })
            return
          }
        } catch {
          setState({ status: 'error', message: errorMessage(error) })
          throw error
        }
      }
      throw error
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ state, login, logout, retrySessionRestore }}
    >
      {children}
    </AuthContext.Provider>
  )
}
