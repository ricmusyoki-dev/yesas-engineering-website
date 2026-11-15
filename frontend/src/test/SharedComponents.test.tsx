import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { Media } from '../components/Media'
import type { PublicMedia } from '../lib/api/types'

const image: PublicMedia = {
  id: 'media-id',
  title: '',
  media_type: 'image',
  content_type: 'image/jpeg',
  content_url: '/api/v1/media/assets/media-id/content/',
  thumbnail_url: null,
  width: 1200,
  height: 800,
  duration_seconds: null,
  alt_text: 'Published image',
  caption: '',
  credit: '',
}

describe('shared accessible components', () => {
  it('announces loading content politely', () => {
    render(<LoadingState />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading content')
  })

  it('announces errors assertively', () => {
    render(<ErrorState message="Please try again." />)

    expect(screen.getByRole('alert')).toHaveTextContent('Please try again.')
  })

  it('announces empty states politely', () => {
    render(<EmptyState message="No published services are available." />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'No published services are available.',
    )
  })

  it('uses the exact backend media path and falls back when an image fails', () => {
    render(<Media media={image} />)

    const displayedImage = screen.getByRole('img', { name: 'Published image' })
    expect(displayedImage).toHaveAttribute('src', image.content_url)

    fireEvent.error(displayedImage)

    expect(screen.getByRole('status')).toHaveTextContent('Media unavailable.')
  })
})
