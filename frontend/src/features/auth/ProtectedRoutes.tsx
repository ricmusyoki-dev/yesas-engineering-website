import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

const MANAGEMENT_ROLES = new Set(['owner', 'technical_admin'])

export function AuthenticatedRoute() {
  const { state, retrySessionRestore } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p role="status" className="text-brand-navy">
          Checking your session…
        </p>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <section
          className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
          role="alert"
        >
          <h1 className="text-2xl font-bold text-brand-navy">
            Dashboard unavailable
          </h1>
          <p className="mt-3 text-slate-600">{state.message}</p>
          <button
            className="mt-6 rounded-lg bg-brand-navy px-5 py-3 font-semibold text-white hover:bg-brand-blue"
            type="button"
            onClick={() => void retrySessionRestore()}
          >
            Retry session check
          </button>
        </section>
      </main>
    )
  }

  if (state.status === 'unauthenticated') {
    return (
      <Navigate
        to="/dashboard/login"
        replace
        state={{ from: location }}
      />
    )
  }

  return <Outlet />
}

export function ManagementRoleRoute() {
  const { state } = useAuth()

  if (
    state.status === 'authenticated' &&
    !MANAGEMENT_ROLES.has(state.user.role)
  ) {
    return <Navigate to="/dashboard/not-authorized" replace />
  }

  return <Outlet />
}

export function LoginRoute() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
        <p role="status" className="text-brand-navy">
          Checking your session…
        </p>
      </main>
    )
  }

  if (state.status === 'authenticated') {
    if (!MANAGEMENT_ROLES.has(state.user.role)) {
      return <Navigate to="/dashboard/not-authorized" replace />
    }

    const from = (location.state as { from?: unknown } | null)?.from
    if (
      typeof from === 'object' &&
      from !== null &&
      'pathname' in from &&
      typeof from.pathname === 'string' &&
      (from.pathname === '/dashboard' ||
        from.pathname.startsWith('/dashboard/')) &&
      from.pathname !== '/dashboard/login'
    ) {
      const search =
        'search' in from && typeof from.search === 'string' ? from.search : ''
      const hash =
        'hash' in from && typeof from.hash === 'string' ? from.hash : ''
      return <Navigate to={`${from.pathname}${search}${hash}`} replace />
    }

    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
