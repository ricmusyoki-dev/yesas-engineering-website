import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const navigationItems = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/company', label: 'Company Profile' },
  { to: '/dashboard/homepage', label: 'Homepage' },
  { to: '/dashboard/services', label: 'Services' },
  { to: '/dashboard/projects', label: 'Projects' },
  { to: '/dashboard/media', label: 'Media Library' },
]

function DashboardNavigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Dashboard navigation">
      <ul className="space-y-1">
        {navigationItems.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink
              className={({ isActive }) =>
                `block rounded-lg px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
                  isActive
                    ? 'bg-brand-navy text-white'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-brand-navy'
                }`
              }
              to={to}
              end={end}
              onClick={onNavigate}
            >
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function DashboardLayout() {
  const { state, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  if (state.status !== 'authenticated') {
    return null
  }

  const fullName = `${state.user.first_name} ${state.user.last_name}`.trim()
  const displayName = fullName || state.user.email

  async function handleLogout() {
    if (!window.confirm('Are you sure you want to sign out?')) {
      return
    }

    setLogoutError('')
    setIsLoggingOut(true)
    try {
      await logout()
      navigate('/dashboard/login', { replace: true })
    } catch {
      setLogoutError('Sign-out could not be completed. Please try again.')
    } finally {
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-brand-navy">
      <header className="flex min-h-18 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:px-8">
        <a
          className="flex flex-col leading-tight focus-visible:rounded-sm"
          href="/"
          aria-label="Yesas Engineering public website"
        >
          <span className="text-base font-bold tracking-[0.14em]">YESAS</span>
          <span className="text-[0.65rem] font-semibold tracking-[0.2em] text-brand-orange">
            ENGINEERING
          </span>
        </a>
        <div className="flex items-center gap-4">
          <p className="hidden text-sm text-slate-600 sm:block">
            Signed in as <span className="font-semibold text-brand-navy">{displayName}</span>
          </p>
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-orange md:hidden"
            type="button"
            aria-expanded={mobileNavigationOpen}
            aria-controls="dashboard-mobile-navigation"
            onClick={() => setMobileNavigationOpen((open) => !open)}
          >
            {mobileNavigationOpen ? 'Close menu' : 'Menu'}
          </button>
        </div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-4.5rem)] max-w-[100rem] md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside
          className={`border-b border-slate-200 bg-white p-4 md:block md:border-b-0 md:border-r md:p-5 ${
            mobileNavigationOpen ? 'block' : 'hidden'
          }`}
          id="dashboard-mobile-navigation"
        >
          <p className="mb-3 px-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Workspace
          </p>
          <DashboardNavigation
            onNavigate={() => setMobileNavigationOpen(false)}
          />
          <div className="mt-5 border-t border-slate-200 pt-4">
            {logoutError && (
              <p className="mb-3 text-sm text-red-800" role="alert">
                {logoutError}
              </p>
            )}
            <button
              className="w-full rounded-lg px-4 py-3 text-left text-sm font-semibold text-brand-blue hover:bg-slate-100 disabled:opacity-60"
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Signing out…' : 'Logout'}
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-5 py-8 sm:px-8 sm:py-10 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
