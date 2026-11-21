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
      className={`reader-feed-card group flex min-w-0 flex-col justify-center gap-1 px-4 py-3.5 ${align === 'right' ? 'items-end text-right' : ''}`}
    >
      <span className="text-xs font-medium text-[var(--text-muted)]">
        {align === 'left' ? `‹ ${label}` : `${label} ›`}
      </span>
      <span className="w-full truncate text-sm font-semibold text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)]">
        {title}
      </span>
    </Link>
  )
}

export function ArticleContinuation({ previousPost, nextPost }: ArticleContinuationProps) {
  const hasAdjacent = previousPost || nextPost

  if (!hasAdjacent) return null

  return (
    <nav aria-label="相邻文章" className="grid gap-3 sm:grid-cols-2">
      {previousPost ? (
        <AdjacentLink href={`/posts/${previousPost.slug}`} label="上一篇" title={previousPost.title} />
      ) : (
        <div className="reader-panel flex items-center px-4 py-3.5 text-xs text-[var(--text-muted)]">
          这是当前时间线中的第一篇文章
        </div>
      )}

      {nextPost ? (
        <AdjacentLink href={`/posts/${nextPost.slug}`} label="下一篇" title={nextPost.title} align="right" />
      ) : (
        <div className="reader-panel flex items-center px-4 py-3.5 text-xs text-[var(--text-muted)] sm:justify-end sm:text-right">
          这是当前时间线中的最新一篇文章
        </div>
      )}
    </nav>
  )
}
