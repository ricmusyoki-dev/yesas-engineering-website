import { createContext } from 'react'
import type { AuthenticatedUser } from './api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }

export interface AuthContextValue {
  state: AuthState
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  retrySessionRestore: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
