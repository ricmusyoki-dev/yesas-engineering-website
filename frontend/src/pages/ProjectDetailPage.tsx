import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function ProjectDetailPage() {
  return (
    <PageFrame title="Project details">
      <EmptyState message="Published project details are not connected in this foundation milestone." />
    </PageFrame>
  )
}
