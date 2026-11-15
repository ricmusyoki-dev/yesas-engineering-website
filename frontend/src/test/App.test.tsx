import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { appRoutes } from '../app/router'
import { Header } from '../components/Header'

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe('public application routes', () => {
  it('renders the home route in the shared public layout', () => {
    renderRoute('/')

    expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content')
    expect(screen.getByRole('contentinfo')).toHaveTextContent('Yesas Engineering')
  })

  it('renders the about route', () => {
    renderRoute('/about')

    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument()
  })

  it('renders the services route', () => {
    renderRoute('/services')

    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument()
  })

  it('renders the projects route', () => {
    renderRoute('/projects')

    expect(screen.getByRole('heading', { name: 'Projects' })).toBeInTheDocument()
  })

  it.each([
    ['/services/example-service', 'Service details'],
    ['/projects/example-project', 'Project details'],
  ])('matches detail route %s', (path, heading) => {
    renderRoute(path)

    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('renders the contact route without a submission form', () => {
    renderRoute('/contact')

    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
  })

  it('renders privacy content as unavailable and omits it from navigation', () => {
    renderRoute('/privacy-policy')

    expect(
      screen.getByRole('heading', { name: 'Privacy policy' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/has not been supplied/i)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Privacy policy' }),
    ).not.toBeInTheDocument()
  })

  it('renders a not-found page for unknown paths', () => {
    renderRoute('/not-a-page')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('accessible responsive navigation', () => {
  it('exposes a labelled navigation and opens and closes its mobile menu', () => {
    render(
      <RouterProvider
        router={createMemoryRouter(
          [{ path: '*', element: <Header /> }],
          { initialEntries: ['/'] },
        )}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Primary navigation' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Privacy policy' })).toBeNull()

    const menuButton = screen.getByRole('button', {
      name: 'Open navigation menu',
    })
    fireEvent.click(menuButton)
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('link', { name: 'Services' }))
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })
})
