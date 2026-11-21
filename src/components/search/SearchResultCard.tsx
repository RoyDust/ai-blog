import Link from 'next/link'
import { ArrowUpRight, Eye, MessageCircle } from 'lucide-react'
import { PostMeta } from '@/components/blog/PostMeta'

interface SearchResultCardProps {
  query: string
  post: {
    id: string
    title: string
    slug: string
    excerpt?: string | null
    content?: string | null
    coverImage?: string | null
    createdAt: string | Date
    author: {
      id: string
      name: string | null
      image: string | null
    }
    category?: {
      name: string
      slug: string
    } | null
    tags: Array<{
      name: string
      slug: string
    }>
    _count: {
      comments: number
      likes: number
    }
    viewCount?: number
  }
}

function buildSnippet(post: SearchResultCardProps['post'], query: string) {
  const excerpt = post.excerpt?.trim()
  const content = post.content?.trim()
  const source = excerpt || content || '暂无内容'

  if (!content || excerpt) {
    return source.length > 140 ? `${source.slice(0, 140).trim()}…` : source
  }

  const keyword = query.trim().toLowerCase()
  if (!keyword) {
    return source.length > 160 ? `${source.slice(0, 160).trim()}…` : source
  }

  const matchIndex = source.toLowerCase().indexOf(keyword)
  if (matchIndex === -1) {
    return source.length > 160 ? `${source.slice(0, 160).trim()}…` : source
  }

  const contextBefore = 48
  const contextAfter = 92
  const start = Math.max(0, matchIndex - contextBefore)
  const end = Math.min(source.length, matchIndex + keyword.length + contextAfter)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < source.length ? '…' : ''

  return `${prefix}${source.slice(start, end).trim()}${suffix}`
}

function highlightText(text: string, query: string) {
  const keyword = query.trim()
  if (!keyword) {
    return text
  }

  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))

  return parts.map((part, index) => {
    if (part.toLowerCase() === keyword.toLowerCase()) {
      return (
        <mark
          key={`${part}-${index}`}
          className="rounded bg-[var(--btn-regular-bg)] px-1 py-0.5 font-semibold text-[var(--btn-content)]"
        >
          {part}
        </mark>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export function SearchResultCard({ post, query }: SearchResultCardProps) {
  const hasExcerpt = Boolean(post.excerpt?.trim())
  const snippet = buildSnippet(post, query)

  return (
    <article className="reader-feed-card group p-5">
      <div className="flex items-center justify-between gap-3">
        <PostMeta category={post.category} publishedAt={post.createdAt} tags={post.tags.slice(0, 2)} variant="compact" />

        <span className="shrink-0 rounded-md bg-[var(--surface-alt)]/75 px-2 py-0.5 text-xs text-[var(--text-muted)]">
          {hasExcerpt ? '摘要' : '正文片段'}
        </span>
      </div>

      <Link href={`/posts/${post.slug}`} className="mt-2 block outline-none">
        <h2 className="text-balance text-lg font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)] md:text-xl">
          {highlightText(post.title, query)}
        </h2>
      </Link>

      <div className="mt-2.5 rounded-xl bg-[color:color-mix(in_oklab,var(--surface-alt)_52%,transparent)] px-3.5 py-2.5 text-sm leading-6 text-[var(--text-body)]">
        {highlightText(snippet, query)}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
        <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums">
          <span className="font-sans">作者 {post.author.name ?? '匿名作者'}</span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
            {post._count.comments} 评论
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            {post.viewCount ?? 0} 浏览
          </span>
        </div>

        <Link
          href={`/posts/${post.slug}`}
          className="reader-link inline-flex items-center gap-1 text-xs font-semibold"
        >
          查看文章
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}
