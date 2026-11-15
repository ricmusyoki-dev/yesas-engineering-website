import type { ReactNode } from 'react'

interface PageFrameProps {
  children: ReactNode
  title: string
}

export function PageFrame({ children, title }: PageFrameProps) {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl">
        {title}
      </h1>
      <div className="mt-8">{children}</div>
    </section>
  )
}
