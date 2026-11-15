import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function AboutPage() {
  return (
    <PageFrame title="About">
      <EmptyState message="Published company information is not connected in this foundation milestone." />
    </PageFrame>
  )
}
