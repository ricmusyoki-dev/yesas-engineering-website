import { useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { PublicMedia } from '../lib/api/types'

interface MediaProps {
  media: PublicMedia
  autoPlay?: boolean
  presentation?: 'default' | 'hero' | 'contain'
  priority?: boolean
}

function MediaContent({
  media,
  autoPlay = false,
  presentation = 'default',
  priority = false,
}: MediaProps) {
  const [unavailable, setUnavailable] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const shouldAutoPlay = autoPlay && prefersReducedMotion === false

  if (unavailable) {
    return (
      <p
        className={
          presentation === 'hero'
            ? 'hero-technical-grid flex h-full items-center justify-center bg-brand-navy p-4 text-sm text-white/80'
            : 'rounded-xl bg-slate-100 p-4 text-sm text-slate-600'
        }
        role="status"
      >
        Media unavailable.
      </p>
    )
  }

  return media.media_type === 'image' ? (
    <img
      className={
        presentation === 'hero'
          ? 'h-full w-full object-cover'
          : presentation === 'contain'
            ? 'mx-auto h-auto max-h-32 w-full object-contain'
            : 'h-auto w-full rounded-2xl object-cover'
      }
      src={media.content_url}
      alt={media.alt_text}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      onError={() => setUnavailable(true)}
    />
  ) : (
    <video
      className={
        presentation === 'hero'
          ? 'h-full w-full bg-brand-navy object-cover'
          : 'h-auto w-full rounded-2xl bg-brand-navy'
      }
      controls
      autoPlay={shouldAutoPlay}
      muted={shouldAutoPlay}
      loop={shouldAutoPlay}
      playsInline
      preload={priority ? 'auto' : 'metadata'}
      poster={media.thumbnail_url ?? undefined}
      aria-label={media.alt_text || media.title || 'Video'}
      onError={() => setUnavailable(true)}
    >
      <source src={media.content_url} type={media.content_type} />
      Your browser does not support this video.
    </video>
  )
}

export function Media({
  media,
  autoPlay,
  presentation = 'default',
  priority,
}: MediaProps) {
  return (
    <figure
      className={
        presentation === 'hero'
          ? 'absolute inset-0'
          : presentation === 'contain'
            ? 'rounded-xl bg-white p-3'
            : 'space-y-2'
      }
    >
      <MediaContent
        key={media.id}
        media={media}
        autoPlay={autoPlay}
        presentation={presentation}
        priority={priority}
      />
      {(media.caption || media.credit) && (
        <figcaption
          className={
            presentation === 'hero'
              ? 'absolute bottom-3 left-4 z-10 rounded bg-brand-navy/80 px-3 py-1 text-xs text-white'
              : 'text-sm text-slate-600'
          }
        >
          {media.caption}
          {media.caption && media.credit && ' · '}
          {media.credit}
        </figcaption>
      )}
    </figure>
  )
}
