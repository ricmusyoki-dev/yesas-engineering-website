import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

const modules = [
  {
    to: '/dashboard/company',
    title: 'Company Profile',
    description: 'Manage company information and contact details.',
    available: true,
  },
  {
    to: '/dashboard/homepage',
    title: 'Homepage',
    description: 'Prepare homepage sections and featured content.',
    available: true,
  },
  {
    to: '/dashboard/services',
    title: 'Services',
    description: 'Organise the service catalogue and categories.',
    available: false,
  },
  {
    to: '/dashboard/projects',
    title: 'Projects',
    description: 'Manage project stories, categories, and tags.',
    available: false,
  },
  {
    to: '/dashboard/media',
    title: 'Media Library',
    description: 'Upload and organise images and video.',
    available: false,
  },
]

export function DashboardOverview() {
  const { state } = useAuth()
  if (state.status !== 'authenticated') {
    return null
  }

  const name =
    `${state.user.first_name} ${state.user.last_name}`.trim() ||
    state.user.email

  return (
    <>
      <div className="border-b border-slate-200 pb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
          Owner workspace
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          Welcome, {name}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-600">
          Your private workspace for preparing updates to the Yesas Engineering
          website. Choose an area to continue.
        </p>
      </div>

      <section aria-labelledby="workspace-heading" className="mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-bold" id="workspace-heading">
            Website areas
          </h2>
          <p className="text-sm text-slate-500">
            Company and homepage editing are available in this milestone.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map((module) => (
            <Link
              className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-blue/50 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-orange"
              key={module.to}
              to={module.to}
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-brand-navy">
                  {module.title}
                </h3>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    module.available
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {module.available ? 'Available' : 'Coming soon'}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {module.description}
              </p>
              <span className="mt-5 inline-block text-sm font-semibold text-brand-blue group-hover:text-brand-navy">
                Open area <span aria-hidden="true">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}

interface DashboardModulePageProps {
  title: string
}

export function DashboardModulePage({ title }: DashboardModulePageProps) {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-blue">
        Website management
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
      <div className="mt-7 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="font-semibold text-brand-navy">
          This area is not available yet.
        </p>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          This dashboard section will be enabled in a later implementation
          milestone. No content has been loaded or changed.
        </p>
        <Link
          className="mt-5 inline-flex rounded-lg bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-brand-orange"
          to="/dashboard"
        >
          Return to overview
        </Link>
      </div>
    </section>
  )
}

export function NotAuthorizedPage() {
  const { logout, state } = useAuth()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')

  async function handleSignOut() {
    try {
      await logout()
      navigate('/dashboard/login', { replace: true })
    } catch {
      setLogoutError('Sign-out could not be completed. Please try again.')
    }
  }

  const role =
    state.status === 'authenticated' ? state.user.role : 'unknown'

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-orange">
          Access restricted
        </p>
        <h1 className="mt-3 text-3xl font-bold text-brand-navy">
          This account cannot manage website content
        </h1>
        <p className="mt-4 text-slate-600">
          The signed-in account role ({role}) is not authorised for the current
          management APIs. Contact the site administrator if you believe this
          is incorrect.
        </p>
        {logoutError && (
          <p className="mt-4 text-sm text-red-800" role="alert">
            {logoutError}
          </p>
        )}
        <button
          className="mt-7 rounded-lg bg-brand-navy px-5 py-3 font-semibold text-white hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-brand-orange"
          type="button"
          onClick={() => void handleSignOut()}
        >
          Sign out
        </button>
      </section>
    </main>
  )
}
