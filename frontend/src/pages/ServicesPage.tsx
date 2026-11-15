import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function ServicesPage() {
  return (
    <PageFrame title="Services">
      <EmptyState message="Published services are not connected in this foundation milestone." />
    </PageFrame>
  )
}
