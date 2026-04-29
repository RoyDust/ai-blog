import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

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
  return (
    <section className="reader-banner onload-animation px-6 py-8 md:px-8 md:py-10">
      <div
        aria-hidden="true"
        className="absolute top-6 right-6 h-32 w-32 rounded-full blur-3xl"
        style={{ background: accent ?? "color-mix(in oklab, var(--accent-warm) 28%, transparent)" }}
      />
      <div aria-hidden="true" className="absolute inset-x-8 bottom-0 h-18 border-t border-white/10">
        <div className="absolute bottom-0 left-0 h-10 w-18 rounded-t-2xl bg-black/10" />
        <div className="absolute bottom-0 left-20 h-14 w-24 rounded-t-3xl bg-black/20" />
        <div className="absolute right-8 bottom-0 h-12 w-28 rounded-t-3xl bg-black/10" />
      </div>

      <div className="relative z-10 flex min-h-[calc(var(--reader-banner-height)-4rem)] flex-col justify-end gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <span className="reader-chip w-fit">
            <Sparkles className="h-3.5 w-3.5 text-[var(--accent-warm)]" />
            {eyebrow}
          </span>
          <div className="space-y-3">
            <h1 className="text-90 text-4xl font-black leading-tight md:text-5xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--text-body)] md:text-base">{description}</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
          <div className="reader-panel rounded-2xl px-4 py-3 text-sm font-medium text-[var(--foreground)]">{countLabel}</div>
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[var(--accent-warm)] bg-[color:color-mix(in_oklab,var(--accent-warm)_16%,transparent)] px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[color:color-mix(in_oklab,var(--accent-warm)_24%,transparent)]"
          >
            {primaryLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-full border border-[var(--reader-border)] px-5 py-2.5 text-sm font-medium text-[var(--text-body)] transition hover:border-[var(--reader-border-strong)] hover:text-[var(--foreground)]"
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
