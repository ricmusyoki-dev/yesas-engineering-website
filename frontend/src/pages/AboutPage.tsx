import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { Media } from '../components/Media'
import { NotFoundState } from '../components/NotFoundState'
import { getCompanyProfile } from '../features/company/api'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { usePublicContent } from '../hooks/usePublicContent'
import type { CompanyProfile, PublicMedia } from '../lib/api/types'

interface ContactLink {
  href: string
  label: string
}

function telephoneHref(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (!/^\d{7,15}$/.test(digits)) {
    return null
  }
  return `tel:${value.trim().startsWith('+') ? '+' : ''}${digits}`
}

function whatsappHref(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  return /^\d{7,15}$/.test(digits) ? `https://wa.me/${digits}` : null
}

function emailHref(value: string): string | null {
  const email = value.trim()
  return /^[^\s@]+@[^\s@]+$/.test(email)
    ? `mailto:${email}`
    : null
}

function safeSocialHref(value: string): string | null {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function ContactDetails({ profile }: { profile: CompanyProfile }) {
  const contactLinks: ContactLink[] = []
  const phone = profile.business_phone.trim()
  const phoneLink = telephoneHref(phone)
  const emailLink = emailHref(profile.business_email)
  const whatsappLink = whatsappHref(profile.whatsapp_number)

  if (phone && phoneLink) {
    contactLinks.push({ href: phoneLink, label: phone })
  }
  if (profile.business_email.trim() && emailLink) {
    contactLinks.push({
      href: emailLink,
      label: profile.business_email.trim(),
    })
  }
  if (profile.whatsapp_number.trim() && whatsappLink) {
    contactLinks.push({
      href: whatsappLink,
      label: `WhatsApp: ${profile.whatsapp_number.trim()}`,
    })
  }

  const socialLinks = [
    { label: 'LinkedIn', value: profile.linkedin_url },
    { label: 'Instagram', value: profile.instagram_url },
    { label: 'Facebook', value: profile.facebook_url },
    { label: 'TikTok', value: profile.tiktok_url },
    { label: 'YouTube', value: profile.youtube_url },
  ]
    .map(({ label, value }) => ({
      label,
      href: value.trim() ? safeSocialHref(value.trim()) : null,
    }))
    .filter(
      (item): item is { label: string; href: string } => item.href !== null,
    )

  const address = [
    profile.physical_address.trim(),
    profile.city.trim(),
    profile.country.trim(),
  ].filter(Boolean)

  if (!contactLinks.length && !socialLinks.length && !address.length) {
    return null
  }

  return (
    <section
      className="bg-slate-50 py-14 sm:py-18"
      aria-labelledby="about-contact-heading"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <h2
          id="about-contact-heading"
          className="text-2xl font-bold text-brand-navy"
        >
          Contact information
        </h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {address.length > 0 && (
            <address className="not-italic leading-7 text-slate-700">
              {address.map((part) => (
                <p key={part}>{part}</p>
              ))}
            </address>
          )}
          {contactLinks.length > 0 && (
            <ul className="space-y-3">
              {contactLinks.map(({ href, label }) => (
                <li key={href}>
                  <a
                    className="font-medium text-brand-blue underline decoration-brand-orange underline-offset-4 hover:text-brand-orange focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
                    href={href}
                    target={href.startsWith('https://wa.me/') ? '_blank' : undefined}
                    rel={
                      href.startsWith('https://wa.me/')
                        ? 'noopener noreferrer'
                        : undefined
                    }
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {socialLinks.length > 0 && (
            <nav aria-label="Company social profiles">
              <ul className="flex flex-wrap gap-3">
                {socialLinks.map(({ href, label }) => (
                  <li key={label}>
                    <a
                      className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 font-medium text-brand-navy transition-colors hover:border-brand-orange hover:text-brand-blue focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-orange"
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
      </div>
    </section>
  )
}

function CompanyImagery({ images }: { images: PublicMedia[] }) {
  if (images.length === 0) {
    return null
  }

  return (
    <section
      className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="company-imagery-heading"
    >
      <h2
        id="company-imagery-heading"
        className="text-2xl font-bold text-brand-navy sm:text-3xl"
      >
        Company imagery
      </h2>
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((media) => (
          <Media key={media.id} media={media} />
        ))}
      </div>
    </section>
  )
}

function AboutContent({ profile }: { profile: CompanyProfile }) {
  const name = profile.name.trim() || 'YESAS ENGINEERING'
  const description = profile.description.trim()
  const overview = profile.overview.trim()
  const serviceAreas = profile.service_areas.filter((area) => area.trim())
  const leadImage = profile.images[0]
  const hasIntroduction = Boolean(description || overview)
  const remainingImages =
    hasIntroduction && leadImage ? profile.images.slice(1) : profile.images

  return (
    <>
      <section className="relative overflow-hidden bg-brand-navy text-white">
        <div
          className="about-technical-detail absolute inset-y-0 right-0 hidden w-1/2 opacity-70 lg:block"
          aria-hidden="true"
        />
        <div className="relative mx-auto flex max-w-7xl flex-col gap-10 px-5 py-16 sm:px-8 sm:py-24 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.2em] text-brand-gold">
              About
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {name}
            </h1>
            {profile.tagline.trim() && (
              <p className="mt-5 max-w-2xl text-lg leading-8 text-white/85 sm:text-xl">
                {profile.tagline}
              </p>
            )}
          </div>
          {profile.logo && (
            <div className="w-full max-w-56 shrink-0 rounded-2xl bg-white p-3 shadow-xl">
              <Media media={profile.logo} presentation="contain" priority />
            </div>
          )}
        </div>
      </section>

      {hasIntroduction && (
        <section
          className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16"
          aria-labelledby="company-overview-heading"
        >
          <div className="max-w-2xl">
            <div className="mb-6 h-1 w-16 rounded-full bg-brand-orange" />
            <h2
              id="company-overview-heading"
              className="text-3xl font-bold tracking-tight text-brand-navy sm:text-4xl"
            >
              Company overview
            </h2>
            {description && (
              <p className="mt-5 whitespace-pre-line text-lg leading-8 text-slate-700">
                {description}
              </p>
            )}
            {overview && (
              <p className="mt-5 whitespace-pre-line leading-8 text-slate-700">
                {overview}
              </p>
            )}
          </div>
          {leadImage && (
            <div className="overflow-hidden rounded-2xl">
              <Media media={leadImage} />
            </div>
          )}
        </section>
      )}

      <CompanyImagery images={remainingImages} />

      {serviceAreas.length > 0 && (
        <section
          className="bg-slate-50 py-14 sm:py-20"
          aria-labelledby="service-areas-heading"
        >
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <h2
              id="service-areas-heading"
              className="text-2xl font-bold text-brand-navy sm:text-3xl"
            >
              Service areas
            </h2>
            <ul className="mt-6 flex flex-wrap gap-3">
              {serviceAreas.map((area) => (
                <li
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700"
                  key={area}
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <ContactDetails profile={profile} />

    </>
  )
}

export function AboutPage() {
  const state = usePublicContent(getCompanyProfile)
  const profileName =
    state.status === 'success'
      ? state.data.name.trim() || 'YESAS ENGINEERING'
      : 'About'
  const profileDescription =
    state.status === 'success'
      ? state.data.description.trim() || state.data.overview.trim() || undefined
      : undefined
  usePageMetadata(
    `${profileName}${profileName === 'About' ? '' : ' | About'} | Yesas Engineering`,
    profileDescription,
  )

  if (state.status === 'loading') {
    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h1 className="sr-only">About</h1>
        <LoadingState message="Loading published company information…" />
      </div>
    )
  }

  if (state.status === 'error') {
    if (state.error.status === 404) {
      return (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <NotFoundState
            title="Company profile unavailable"
            message="Published company profile information is not currently available."
          />
        </div>
      )
    }

    return (
      <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <h1 className="sr-only">About</h1>
        <ErrorState message="Company information is temporarily unavailable. Please try again later." />
      </div>
    )
  }

  return <AboutContent profile={state.data} />
}
