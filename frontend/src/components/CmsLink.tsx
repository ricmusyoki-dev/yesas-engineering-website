import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface CmsLinkProps {
  children: ReactNode
  destination: string
  className?: string
}

function isInternalDestination(destination: string) {
  return destination.startsWith('/') && !destination.startsWith('//')
}

function isSafeExternalDestination(destination: string) {
  try {
    const url = new URL(destination)
    return (
      url.protocol === 'https:' &&
      url.hostname.length > 0 &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}

export function CmsLink({ children, destination, className }: CmsLinkProps) {
  if (isInternalDestination(destination)) {
    return (
      <Link className={className} to={destination}>
        {children}
      </Link>
    )
  }

  if (!isSafeExternalDestination(destination)) {
    return null
  }

  return (
    <a
      className={className}
      href={destination}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  )
}
