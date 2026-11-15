import { CmsLink } from '../components/CmsLink'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { Media } from '../components/Media'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { usePublicContent } from '../hooks/usePublicContent'
import { getHomepageContent } from '../features/company/api'
import type {
  HomepageSection,
  PublicProject,
  PublicService,
} from '../lib/api/types'

const primaryActionClass =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-brand-orange px-6 py-3 font-semibold text-brand-navy transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange'

function SectionHeading({
  as: Heading = 'h2',
  tone = 'dark',
  children,
}: {
  as?: 'h1' | 'h2'
  tone?: 'dark' | 'light'
  children: string
}) {
  return (
    <Heading
      className={`text-3xl font-bold tracking-tight sm:text-4xl ${
        tone === 'light' ? 'text-white' : 'text-brand-navy'
      }`}
    >
      {children}
    </Heading>
  )
}

function SectionCopy({
  text,
  tone = 'dark',
}: {
  text: string
  tone?: 'dark' | 'light'
}) {
  return text.trim() ? (
    <p
      className={`mt-4 whitespace-pre-line text-base leading-8 sm:text-lg ${
        tone === 'light' ? 'text-white/85' : 'text-slate-700'
      }`}
    >
      {text}
    </p>
  ) : null
}

function SectionAction({
  section,
  className = primaryActionClass,
}: {
  section: HomepageSection
  className?: string
}) {
  if (!section.cta_label.trim() || !section.cta_destination.trim()) {
    return null
  }

  return (
    <CmsLink className={className} destination={section.cta_destination}>
      {section.cta_label}
    </CmsLink>
  )
}

function HeroSection({
  section,
  headingLevel,
}: {
  section: HomepageSection
  headingLevel: 'h1' | 'h2'
}) {
  const backgroundMedia = section.hero_image ?? section.hero_video

  return (
    <section
      className="relative isolate flex min-h-[min(760px,88svh)] items-center overflow-hidden bg-brand-navy"
      aria-label={section.heading || 'Homepage introduction'}
      data-homepage-section={section.section_type}
    >
      <div className="absolute inset-0 z-0">
        {backgroundMedia ? (
          <Media
            media={backgroundMedia}
            autoPlay={backgroundMedia.media_type === 'video'}
            presentation="hero"
            priority
          />
        ) : (
          <div
            className="hero-technical-grid absolute inset-0"
            aria-hidden="true"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-navy via-brand-navy/90 to-brand-navy/40" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
        <div className="max-w-3xl">
          {section.heading.trim() ? (
            <SectionHeading as={headingLevel} tone="light">
              {section.heading}
            </SectionHeading>
          ) : headingLevel === 'h1' ? (
            <h1 className="sr-only">Yesas Engineering</h1>
          ) : null}
          <div className="mt-6 max-w-2xl">
            <SectionCopy text={section.body} tone="light" />
          </div>
          {section.cta_label.trim() && section.cta_destination.trim() && (
            <div className="mt-8 flex flex-wrap gap-3">
              <SectionAction section={section} />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function IntroductionSection({
  section,
  headingLevel,
}: {
  section: HomepageSection
  headingLevel: 'h1' | 'h2'
}) {
  const image = section.images[0]

  return (
    <section
      className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16"
      data-homepage-section={section.section_type}
    >
      <div className="max-w-2xl">
        <div className="mb-6 h-1 w-16 rounded-full bg-brand-orange" />
        {section.heading.trim() && (
          <SectionHeading as={headingLevel}>
            {section.heading}
          </SectionHeading>
        )}
        <SectionCopy text={section.body} />
        {section.cta_label.trim() && section.cta_destination.trim() && (
          <div className="mt-7">
            <SectionAction
              section={section}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-navy px-6 py-3 font-semibold text-white transition-colors hover:bg-brand-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
            />
          </div>
        )}
      </div>
      {image && (
        <div className="overflow-hidden rounded-2xl">
          <Media media={image} />
        </div>
      )}
      {image && section.images.length > 1 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
          {section.images.slice(1).map((media) => (
            <Media key={media.id} media={media} />
          ))}
        </div>
      )}
    </section>
  )
}

function ServiceCard({ service }: { service: PublicService }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg">
      {service.cover_image && (
        <CmsLink
          className="block overflow-hidden"
          destination={`/services/${encodeURIComponent(service.slug)}`}
        >
          <Media media={service.cover_image} />
        </CmsLink>
      )}
      <div className="flex flex-1 flex-col p-6">
        {service.category && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
            {service.category.name}
          </p>
        )}
        <h3 className="mt-2 text-xl font-bold text-brand-navy">
          <CmsLink
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            destination={`/services/${encodeURIComponent(service.slug)}`}
          >
            {service.title}
          </CmsLink>
        </h3>
        {service.summary && (
          <p className="mt-3 flex-1 leading-7 text-slate-700">
            {service.summary}
          </p>
        )}
        <CmsLink
          className="mt-5 inline-flex w-fit items-center gap-2 font-semibold text-brand-blue transition-colors hover:text-brand-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
          destination={`/services/${encodeURIComponent(service.slug)}`}
        >
          View service <span aria-hidden="true">→</span>
        </CmsLink>
      </div>
    </article>
  )
}

function FeaturedServicesSection({
  section,
  headingLevel,
}: {
  section: HomepageSection
  headingLevel: 'h1' | 'h2'
}) {
  return (
    <section
      className="bg-slate-50 py-16 sm:py-24"
      data-homepage-section={section.section_type}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <div className="mb-6 h-1 w-16 rounded-full bg-brand-orange" />
          {section.heading.trim() && (
            <SectionHeading as={headingLevel}>
              {section.heading}
            </SectionHeading>
          )}
          <SectionCopy text={section.body} />
        </div>
        {section.featured_services.length ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {section.featured_services.map((service) => (
              <ServiceCard key={service.slug} service={service} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              title="No featured services"
              message="There are no published services selected for this section."
            />
          </div>
        )}
        {section.cta_label.trim() && section.cta_destination.trim() && (
          <div className="mt-8">
            <SectionAction section={section} />
          </div>
        )}
      </div>
    </section>
  )
}

function ProjectCard({ project }: { project: PublicProject }) {
  const projectPath = `/projects/${encodeURIComponent(project.slug)}`
  const location = [project.location, project.country]
    .filter((value) => value.trim())
    .join(', ')

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-lg">
      {project.cover_image && (
        <CmsLink className="block overflow-hidden" destination={projectPath}>
          <Media media={project.cover_image} />
        </CmsLink>
      )}
      <div className="flex flex-1 flex-col p-6">
        {project.category && (
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-blue">
            {project.category.name}
          </p>
        )}
        <h3 className="mt-2 text-xl font-bold text-brand-navy">
          <CmsLink
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
            destination={projectPath}
          >
            {project.title}
          </CmsLink>
        </h3>
        {project.summary && (
          <p className="mt-3 leading-7 text-slate-700">{project.summary}</p>
        )}
        {(location || project.client_name) && (
          <dl className="mt-4 space-y-2 text-sm text-slate-600">
            {location && (
              <div>
                <dt className="inline font-semibold">Location: </dt>
                <dd className="inline">{location}</dd>
              </div>
            )}
            {project.client_name && (
              <div>
                <dt className="inline font-semibold">Client: </dt>
                <dd className="inline">{project.client_name}</dd>
              </div>
            )}
          </dl>
        )}
        <CmsLink
          className="mt-5 inline-flex w-fit items-center gap-2 font-semibold text-brand-blue transition-colors hover:text-brand-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
          destination={projectPath}
        >
          View project <span aria-hidden="true">→</span>
        </CmsLink>
      </div>
    </article>
  )
}

function FeaturedProjectsSection({
  section,
  headingLevel,
}: {
  section: HomepageSection
  headingLevel: 'h1' | 'h2'
}) {
  return (
    <section
      className="bg-brand-navy py-16 sm:py-24"
      data-homepage-section={section.section_type}
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="max-w-3xl">
          <div className="mb-6 h-1 w-16 rounded-full bg-brand-orange" />
          {section.heading.trim() && (
            <SectionHeading as={headingLevel} tone="light">
              {section.heading}
            </SectionHeading>
          )}
          <SectionCopy text={section.body} tone="light" />
        </div>
        {section.featured_projects.length ? (
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {section.featured_projects.map((project) => (
              <ProjectCard key={project.slug} project={project} />
            ))}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              title="No featured projects"
              message="There are no published projects selected for this section."
            />
          </div>
        )}
        {section.cta_label.trim() && section.cta_destination.trim() && (
          <div className="mt-8">
            <SectionAction section={section} />
          </div>
        )}
      </div>
    </section>
  )
}

function ContactCtaSection({
  section,
  headingLevel,
}: {
  section: HomepageSection
  headingLevel: 'h1' | 'h2'
}) {
  return (
    <section
      className="bg-brand-navy py-16 text-white sm:py-20"
      data-homepage-section={section.section_type}
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <div className="mb-6 h-1 w-16 rounded-full bg-brand-orange" />
          {section.heading.trim() && (
            <SectionHeading as={headingLevel} tone="light">
              {section.heading}
            </SectionHeading>
          )}
          <SectionCopy text={section.body} tone="light" />
        </div>
        {section.cta_label.trim() && section.cta_destination.trim() && (
          <SectionAction section={section} />
        )}
      </div>
    </section>
  )
}

function renderHomepageSection(
  section: HomepageSection,
  headingLevel: 'h1' | 'h2',
) {
  switch (section.section_type) {
    case 'HERO':
      return <HeroSection section={section} headingLevel={headingLevel} />
    case 'INTRODUCTION':
      return (
        <IntroductionSection section={section} headingLevel={headingLevel} />
      )
    case 'FEATURED_SERVICES':
      return (
        <FeaturedServicesSection
          section={section}
          headingLevel={headingLevel}
        />
      )
    case 'FEATURED_PROJECTS':
      return (
        <FeaturedProjectsSection
          section={section}
          headingLevel={headingLevel}
        />
      )
    case 'CONTACT_CTA':
      return <ContactCtaSection section={section} headingLevel={headingLevel} />
  }
}

export function HomePage() {
  const state = usePublicContent(getHomepageContent)
  const sections =
    state.status === 'success'
      ? state.data.sections
          .filter((section) => section.is_visible)
          .slice()
          .sort((left, right) => left.display_order - right.display_order)
      : []
  const primaryHeading =
    sections.find((section) => section.section_type === 'HERO')?.heading ||
    sections.find((section) => section.heading.trim())?.heading
  const description =
    sections.find((section) => section.section_type === 'INTRODUCTION')?.body ||
    sections.find((section) => section.body.trim())?.body

  usePageMetadata(
    primaryHeading
      ? `${primaryHeading} | Yesas Engineering`
      : 'Yesas Engineering',
    description,
  )

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h1 className="sr-only">Home</h1>
        <LoadingState message="Loading published homepage content…" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h1 className="sr-only">Home</h1>
        <ErrorState message="Homepage content is temporarily unavailable. Please try again later." />
      </div>
    )
  }

  if (sections.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h1 className="text-3xl font-bold text-brand-navy">Home</h1>
        <div className="mt-8">
          <EmptyState message="There is no published homepage content available." />
        </div>
      </div>
    )
  }

  const firstHeadingIndex = sections.findIndex((section) =>
    section.heading.trim(),
  )

  return (
    <>
      {firstHeadingIndex === -1 && <h1 className="sr-only">Home</h1>}
      {sections.map((section, index) => (
        <div key={section.section_type}>
          {renderHomepageSection(
            section,
            index === firstHeadingIndex ? 'h1' : 'h2',
          )}
        </div>
      ))}
    </>
  )
}
