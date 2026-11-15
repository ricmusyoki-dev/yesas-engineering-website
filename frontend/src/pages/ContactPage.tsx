import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function ContactPage() {
  return (
    <PageFrame title="Contact">
      <EmptyState message="Published contact information is not connected in this foundation milestone." />
    </PageFrame>
  )
}
