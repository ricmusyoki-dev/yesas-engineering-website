import { Outlet } from 'react-router-dom'
import { Footer } from '../components/Footer'
import { Header } from '../components/Header'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-brand-navy">
      <a
        className="skip-link"
        href="#main-content"
      >
        Skip to content
      </a>
      <Header />
      <main
        id="main-content"
        className="flex-1"
        tabIndex={-1}
      >
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
