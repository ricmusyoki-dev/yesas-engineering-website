import type { CompanyProfile } from '../lib/api/types'
import { EmptyState } from './EmptyState'

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
  return /^[^\s@]+@[^\s@]+$/.test(email) ? `mailto:${email}` : null
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

export function CompanyContactDetails({
  profile,
  heading = 'Contact information',
  emptyMessage,
}: {
  profile: CompanyProfile
  heading?: string
  emptyMessage?: string
}) {
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
    return emptyMessage ? (
      <div className="public-container">
        <EmptyState
          title="Contact details not yet available"
          message={emptyMessage}
        />
      </div>
    ) : null
  }

  return (
    <section
      className="bg-brand-surface py-14 sm:py-18"
      aria-labelledby="company-contact-heading"
    >
      <div className="public-container">
        <h2
          id="company-contact-heading"
          className="text-2xl font-bold text-brand-navy sm:text-3xl"
        >
          {heading}
        </h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {address.length > 0 && (
            <address className="public-card not-italic leading-7 text-slate-700">
              <div className="p-5">
                <h3 className="font-semibold text-brand-navy">Address</h3>
                <div className="mt-2">
                  {address.map((part) => (
                    <p key={part}>{part}</p>
                  ))}
                </div>
              </div>
            </address>
          )}
          {contactLinks.length > 0 && (
            <section className="public-card p-5" aria-label="Contact methods">
              <h3 className="font-semibold text-brand-navy">Get in touch</h3>
              <ul className="mt-3 space-y-3">
                {contactLinks.map(({ href, label }) => (
                  <li key={href}>
                    <a
                      className="font-medium text-brand-blue underline decoration-brand-orange underline-offset-4 hover:text-brand-orange"
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
            </section>
          )}
          {socialLinks.length > 0 && (
            <section className="public-card p-5" aria-label="Social profiles">
              <h3 className="font-semibold text-brand-navy">Social profiles</h3>
              <nav className="mt-3" aria-label="Company social profiles">
                <ul className="flex flex-wrap gap-2">
                  {socialLinks.map(({ href, label }) => (
                    <li key={label}>
                      <a
                        className="inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 font-medium text-brand-navy transition-colors hover:border-brand-orange hover:text-brand-blue"
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
            </section>
          )}
        </div>
      </div>
    </section>
  )
}
