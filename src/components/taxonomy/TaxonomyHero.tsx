import Link from 'next/link'

interface TaxonomyHeroProps {
  eyebrow: string
  title: string
  description: string
  countLabel: string
  primaryHref: string
  primaryLabel: string
  secondaryHref: string
  secondaryLabel: string
  accent?: string
}

export function TaxonomyHero({
  eyebrow,
  title,
  description,
  countLabel,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  accent,
}: TaxonomyHeroProps) {
  return (
    <section className="card-base onload-animation relative overflow-hidden px-6 py-8 md:px-8 md:py-10">
      <div
        className="pointer-events-none absolute top-0 right-0 h-40 w-40 rounded-full blur-3xl"
        style={{ background: accent ?? 'color-mix(in srgb, var(--primary) 14%, transparent)' }}
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <p className="text-50 text-xs font-semibold uppercase tracking-[0.28em]">{eyebrow}</p>
          <div className="space-y-3">
            <h1 className="text-90 text-4xl font-black tracking-[-0.04em] md:text-5xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted)] md:text-base">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--foreground)]">
            {countLabel}
          </div>
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center rounded-full border border-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary)] transition hover:bg-[color:color-mix(in_srgb,var(--primary)_10%,transparent)]"
          >
            {primaryLabel}
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  )
}
