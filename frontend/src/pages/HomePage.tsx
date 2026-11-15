import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function HomePage() {
  return (
    <PageFrame title="Home">
      <EmptyState message="Homepage content is not connected in this foundation milestone." />
    </PageFrame>
  )
}
