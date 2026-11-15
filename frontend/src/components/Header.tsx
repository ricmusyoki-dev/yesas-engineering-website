import { useEffect, useRef, useState } from 'react'
import { NavLink } from 'react-router-dom'

const navigationItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/services', label: 'Services' },
  { to: '/projects', label: 'Projects' },
  { to: '/contact', label: 'Contact' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [menuOpen])

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <NavLink
          aria-label="Yesas Engineering home"
          className="text-lg font-bold tracking-wide text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
          to="/"
          end
          onClick={() => setMenuOpen(false)}
        >
          YESAS <span className="text-brand-orange">ENGINEERING</span>
        </NavLink>

        <button
          ref={menuButtonRef}
          className="rounded-full border border-slate-300 px-4 py-2 font-semibold text-brand-navy transition-colors hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange md:hidden"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{menuOpen ? 'Close' : 'Menu'}</span>
        </button>

        <nav
          id="primary-navigation"
          aria-label="Primary navigation"
          className={
            menuOpen
              ? 'w-full md:w-auto'
              : 'hidden w-full md:flex md:w-auto'
          }
        >
          <ul className="flex flex-col gap-1 md:flex-row md:items-center md:gap-2">
            {navigationItems.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  className={({ isActive }) =>
                    `block rounded-full px-4 py-2 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
                      isActive
                        ? 'bg-brand-navy text-white'
                        : 'text-brand-navy hover:bg-slate-100'
                    }`
                  }
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
