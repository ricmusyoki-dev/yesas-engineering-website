import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function ProjectsPage() {
  return (
    <PageFrame title="Projects">
      <EmptyState message="Published projects are not connected in this foundation milestone." />
    </PageFrame>
  )
}
