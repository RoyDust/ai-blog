import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface TaxonomyHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  accent?: string;
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
  void accent;

  return (
    <section className="reader-banner onload-animation !min-h-0 !rounded-[var(--radius-panel)] !bg-[var(--reader-panel)] before:!hidden px-5 py-5 md:px-6 md:py-6">
      <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 max-w-2xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="reader-chip">{eyebrow}</span>
            <span className="rounded-md bg-[var(--surface-alt)]/75 px-2.5 py-1 font-mono text-xs tabular-nums text-[var(--text-muted)]">
              {countLabel}
            </span>
          </div>
          <h1 className="text-90 font-display text-2xl font-bold leading-snug tracking-tight md:text-3xl">{title}</h1>
          <p className="max-w-xl text-sm leading-6 text-[var(--text-body)]">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          <Link href={primaryHref} className="home-primary-cta">
            {primaryLabel}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex h-[2.125rem] shrink-0 items-center justify-center whitespace-nowrap rounded-[0.625rem] bg-[var(--surface-alt)]/75 px-3.5 text-[0.8125rem] font-medium text-[var(--text-body)] transition hover:bg-[var(--btn-plain-bg-hover)] hover:text-[var(--foreground)]"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
