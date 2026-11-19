import { CompanyContactDetails } from '../components/CompanyContactDetails'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { getCompanyProfile } from '../features/company/api'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { usePublicContent } from '../hooks/usePublicContent'
import { PageFrame } from './PageFrame'

export function ContactPage() {
  const state = usePublicContent(getCompanyProfile)
  const companyName =
    state.status === 'success'
      ? state.data.name.trim() || 'Yesas Engineering'
      : 'Yesas Engineering'
  usePageMetadata(`Contact | ${companyName}`)

  return (
    <PageFrame title="Contact">
      {state.status === 'loading' ? (
        <LoadingState message="Loading published contact information…" />
      ) : state.status === 'error' ? (
        state.error.status === 404 ? (
          <EmptyState
            title="Contact information unavailable"
            message="Published company contact information is not currently available."
          />
        ) : (
          <ErrorState message="Contact information is temporarily unavailable. Please try again later." />
        )
      ) : (
        <div className="-mx-5 -mt-8 sm:-mx-8">
          {(state.data.name.trim() || state.data.tagline.trim()) && (
            <section className="bg-brand-navy px-5 py-10 text-white sm:px-8 sm:py-14">
              <div className="public-container">
                {state.data.name.trim() && (
                  <p className="font-semibold uppercase tracking-wide text-brand-gold">
                    {state.data.name}
                  </p>
                )}
                {state.data.tagline.trim() && (
                  <p className="mt-2 max-w-2xl text-lg leading-8 text-white/85">
                    {state.data.tagline}
                  </p>
                )}
              </div>
            </section>
          )}
          <div className="py-8">
            <CompanyContactDetails
              profile={state.data}
              heading="Ways to get in touch"
              emptyMessage="Published contact information has not been provided."
            />
          </div>
        </div>
      )}
    </PageFrame>
  )
}
