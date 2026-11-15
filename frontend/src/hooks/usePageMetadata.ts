import { useEffect } from 'react'

export function usePageMetadata(title: string, description?: string) {
  useEffect(() => {
    document.title = title

    let descriptionMeta = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (!descriptionMeta) {
      descriptionMeta = document.createElement('meta')
      descriptionMeta.name = 'description'
      document.head.append(descriptionMeta)
    }

    descriptionMeta.content =
      description?.trim().slice(0, 160) ||
      'Official website of Yesas Engineering.'

    return () => {
      document.title = 'Yesas Engineering'
      descriptionMeta.content = 'Official website of Yesas Engineering.'
    }
  }, [description, title])
}
