import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'

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
      className={`reader-feed-card group flex min-h-32 flex-col justify-between gap-5 p-5 ${align === 'right' ? 'items-end text-right' : ''}`}
    >
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
        {align === 'left' ? <ArrowLeft className="h-4 w-4" /> : null}
        {label}
        {align === 'right' ? <ArrowRight className="h-4 w-4" /> : null}
      </p>
      <h3 className="text-lg font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[var(--accent-warm)]">{title}</h3>
    </Link>
  )
}

export function ArticleContinuation({ previousPost, nextPost }: ArticleContinuationProps) {
  const hasAdjacent = previousPost || nextPost

  if (!hasAdjacent) return null

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2 className="font-display text-2xl font-bold text-[var(--foreground)]">继续阅读</h2>
        <p className="text-sm text-[var(--muted)]">按发布时间在相邻文章之间切换，保持阅读节奏不断开。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {previousPost ? (
          <AdjacentLink href={`/posts/${previousPost.slug}`} label="上一篇" title={previousPost.title} />
        ) : (
          <div className="rounded-[calc(var(--radius-large)+0.125rem)] border border-dashed border-[var(--reader-border)] p-5 text-sm leading-6 text-[var(--text-muted)]">这是当前时间线中的第一篇文章。</div>
        )}

        {nextPost ? (
          <AdjacentLink href={`/posts/${nextPost.slug}`} label="下一篇" title={nextPost.title} align="right" />
        ) : (
          <div className="rounded-[calc(var(--radius-large)+0.125rem)] border border-dashed border-[var(--reader-border)] p-5 text-sm leading-6 text-[var(--text-muted)] md:text-right">这是当前时间线中的最新一篇文章。</div>
        )}
      </div>
    </div>
  )
}
