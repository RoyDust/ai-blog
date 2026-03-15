import Link from 'next/link'

interface AdjacentPost {
  slug: string
  title: string
  createdAt: string | Date
}

interface ArticleContinuationProps {
  previousPost: AdjacentPost | null
  nextPost: AdjacentPost | null
}

function AdjacentLink({ label, href, title, align = 'left' }: { label: string; href: string; title: string; align?: 'left' | 'right' }) {
  return (
    <Link
      href={href}
      className={`group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[color:color-mix(in_srgb,var(--primary)_35%,var(--border))] hover:bg-[var(--surface-alt)] ${align === 'right' ? 'text-right' : ''}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
      <h3 className="mt-3 text-lg font-bold text-[var(--foreground)] transition group-hover:text-[var(--primary)]">{title}</h3>
    </Link>
  )
}

export function ArticleContinuation({ previousPost, nextPost }: ArticleContinuationProps) {
  const hasAdjacent = previousPost || nextPost

  return (
    <div className="mx-auto w-full max-w-[980px] space-y-6 xl:min-w-[880px]">
      {hasAdjacent ? (
        <section className="card-base p-6 md:p-8">
          <div className="mb-5 space-y-2">
            <h2 className="font-display text-2xl font-bold text-[var(--foreground)]">继续阅读</h2>
            <p className="text-sm text-[var(--muted)]">按发布时间在相邻文章之间切换，保持阅读节奏不断开。</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {previousPost ? (
              <AdjacentLink href={`/posts/${previousPost.slug}`} label="上一篇" title={previousPost.title} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)]">这是当前时间线中的第一篇文章。</div>
            )}

            {nextPost ? (
              <AdjacentLink href={`/posts/${nextPost.slug}`} label="下一篇" title={nextPost.title} align="right" />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--muted)] md:text-right">这是当前时间线中的最新一篇文章。</div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  )
}
