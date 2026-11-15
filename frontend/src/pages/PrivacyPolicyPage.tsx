import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function PrivacyPolicyPage() {
  return (
    <PageFrame title="Privacy policy">
      <EmptyState
        title="Content unavailable"
        message="Privacy policy content has not been supplied. This page will remain unavailable until approved legal content is provided."
      />
    </PageFrame>
  )
}
