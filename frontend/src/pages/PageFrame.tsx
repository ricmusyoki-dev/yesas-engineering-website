import type { ReactNode } from 'react'

interface PageFrameProps {
  children: ReactNode
  title: string
}

export function PageFrame({ children, title }: PageFrameProps) {
  return (
    <section className="public-container py-12 sm:py-16">
      <h1 className="public-heading">
        {title}
      </h1>
      <div className="mt-8">{children}</div>
    </section>
  )
}
