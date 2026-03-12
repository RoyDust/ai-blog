import Link from 'next/link'

interface TaxonomyDirectoryCardProps {
  href: string
  name: string
  description?: string | null
  count: number
  badge?: string
  accent?: string | null
}

export function TaxonomyDirectoryCard({ href, name, description, count, badge, accent }: TaxonomyDirectoryCardProps) {
  return (
    <article className="group card-base relative overflow-hidden p-6 transition hover:-translate-y-1 hover:border-[color:color-mix(in_srgb,var(--primary)_24%,var(--border))] hover:shadow-[0_20px_48px_-36px_rgba(15,23,42,0.45)]">
      {accent ? (
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 h-1 w-full opacity-80"
          style={{ background: accent }}
        />
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          {badge ? (
            <span className="inline-flex rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
              {badge}
            </span>
          ) : null}
          <div>
            <Link href={href} className="text-90 text-2xl font-black tracking-[-0.03em] transition group-hover:text-[var(--primary)]">
              {name}
            </Link>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              {description?.trim() || '围绕这个主题持续阅读、快速回顾相关文章与知识脉络。'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-2 text-right">
          <div className="text-lg font-bold text-[var(--foreground)]">{count}</div>
          <div className="text-xs text-[var(--muted)]">篇文章</div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3 border-t border-dashed border-[var(--border)] pt-4 text-sm">
        <span className="text-[var(--muted)]">进入专题页继续浏览</span>
        <Link href={href} className="font-medium text-[var(--primary)] transition group-hover:translate-x-0.5">
          查看内容 →
        </Link>
      </div>
    </article>
  )
}
