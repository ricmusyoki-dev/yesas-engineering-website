import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function ServiceDetailPage() {
  return (
    <PageFrame title="Service details">
      <EmptyState message="Published service details are not connected in this foundation milestone." />
    </PageFrame>
  )
}
