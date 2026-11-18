import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SessionApiError } from './api'
import { useAuth } from './useAuth'

function messageForLoginError(error: unknown): string {
  if (error instanceof SessionApiError) {
    if (error.status === 400) {
      return 'Invalid email or password.'
    }
    return error.message
  }
  return 'Sign-in could not be completed. Please try again.'
}

export function LoginPage() {
  const { login, state } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldError, setFieldError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!email.trim() || !password) {
      setFieldError('Enter both your email address and password.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFieldError('Enter a valid email address.')
      return
    }

    setFieldError('')
    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
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
          'search' in from && typeof from.search === 'string'
            ? from.search
            : ''
        const hash =
          'hash' in from && typeof from.hash === 'string' ? from.hash : ''
        navigate(`${from.pathname}${search}${hash}`, { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (error) {
      setErrorMessage(messageForLoginError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative flex min-h-56 flex-col justify-between overflow-hidden bg-brand-navy px-7 py-8 text-white sm:px-12 sm:py-12 lg:min-h-screen lg:px-16 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              'linear-gradient(rgb(255 255 255 / 5%) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 5%) 1px, transparent 1px)',
            backgroundSize: '3rem 3rem',
            maskImage:
              'radial-gradient(ellipse at 68% 48%, #000 0%, transparent 76%)',
          }}
        />
        <a
          className="relative inline-flex w-fit flex-col leading-tight focus-visible:rounded-sm"
          href="/"
        >
          <span className="text-xl font-bold tracking-[0.18em] sm:text-2xl">
            YESAS
          </span>
          <span className="mt-1 text-xs font-semibold tracking-[0.28em] text-brand-orange sm:text-sm">
            ENGINEERING
          </span>
        </a>
        <div className="relative mt-10 max-w-xl lg:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-gold">
            Owner administration
          </p>
          <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Manage your digital presence with confidence.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-7 text-slate-200 sm:text-base">
            A private workspace for the people responsible for the Yesas
            Engineering website.
          </p>
          <div
            aria-hidden="true"
            className="mt-8 h-1 w-20 rounded-full bg-brand-orange"
          />
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <div className="mb-9">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-blue">
              Secure sign-in
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-brand-navy">
              Welcome back
            </h2>
            <p className="mt-2 text-slate-600">
              Sign in to the private administration dashboard.
            </p>
          </div>

          {state.status === 'error' && (
            <p
              className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {state.message} You can still try signing in.
            </p>
          )}

          <form className="space-y-5" noValidate onSubmit={handleSubmit}>
            <div>
              <label
                className="mb-2 block text-sm font-semibold text-brand-navy"
                htmlFor="login-email"
              >
                Email address
              </label>
              <input
                autoComplete="username"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-brand-navy placeholder:text-slate-400 focus-visible:border-brand-blue"
                id="login-email"
                name="email"
                type="email"
                value={email}
                aria-describedby={fieldError ? 'login-field-error' : undefined}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div>
              <label
                className="mb-2 block text-sm font-semibold text-brand-navy"
                htmlFor="login-password"
              >
                Password
              </label>
              <div className="flex rounded-lg border border-slate-300 focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/20">
                <input
                  autoComplete="current-password"
                  className="min-w-0 flex-1 rounded-l-lg border-0 bg-white px-4 py-3 text-brand-navy focus-visible:outline-none"
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  aria-describedby={fieldError ? 'login-field-error' : undefined}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  className="rounded-r-lg px-4 text-sm font-semibold text-brand-blue hover:bg-slate-50 focus-visible:outline-offset-[-3px]"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-controls="login-password"
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {fieldError && (
              <p id="login-field-error" className="text-sm text-red-800" role="alert">
                {fieldError}
              </p>
            )}
            {errorMessage && (
              <p
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                role="alert"
              >
                {errorMessage}
              </p>
            )}

            <button
              className="flex w-full items-center justify-center rounded-lg bg-brand-orange px-5 py-3.5 font-semibold text-brand-navy transition-colors hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-65"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            This area is restricted to authorised Yesas Engineering
            administrators. Contact your administrator if you need access.
          </p>
        </div>
      </section>
    </main>
  )
}
