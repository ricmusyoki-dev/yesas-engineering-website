import { EmptyState } from '../components/EmptyState'
import { PageFrame } from './PageFrame'

export function PrivacyPolicyPage() {
  return (
    <PageFrame title="Privacy policy">
      <div className="max-w-prose">
        <EmptyState
          title="Content unavailable"
          message="Privacy policy content has not been supplied. This page will remain unavailable until approved legal content is provided."
        />
      </div>
    </PageFrame>
  )
}
