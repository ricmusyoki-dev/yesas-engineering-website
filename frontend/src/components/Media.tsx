import { useState } from 'react'
import type { PublicMedia } from '../lib/api/types'

interface MediaProps {
  media: PublicMedia
}

function MediaContent({ media }: MediaProps) {
  const [unavailable, setUnavailable] = useState(false)

  if (unavailable) {
    return (
      <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600" role="status">
        Media unavailable.
      </p>
    )
  }

  return media.media_type === 'image' ? (
    <img
      className="h-auto w-full rounded-2xl object-cover"
      src={media.content_url}
      alt={media.alt_text}
      onError={() => setUnavailable(true)}
    />
  ) : (
    <video
      className="h-auto w-full rounded-2xl bg-brand-navy"
      controls
      preload="metadata"
      poster={media.thumbnail_url ?? undefined}
      aria-label={media.alt_text || media.title || 'Video'}
      onError={() => setUnavailable(true)}
    >
      <source src={media.content_url} type={media.content_type} />
      Your browser does not support this video.
    </video>
  )
}

export function Media({ media }: MediaProps) {
  return (
    <figure className="space-y-2">
      <MediaContent key={media.id} media={media} />
      {(media.caption || media.credit) && (
        <figcaption className="text-sm text-slate-600">
          {media.caption}
          {media.caption && media.credit && ' · '}
          {media.credit}
        </figcaption>
      )}
    </figure>
  )
}
