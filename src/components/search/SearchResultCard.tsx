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
          className="rounded bg-[color:color-mix(in_srgb,var(--brand)_18%,transparent)] px-1 py-0.5 text-[var(--foreground)]"
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
    <article className="group relative overflow-hidden rounded-[var(--radius-large)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)] transition duration-200 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--brand)_35%,var(--border))] hover:shadow-[0_24px_70px_-35px_rgba(15,23,42,0.45)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand)]/50 to-transparent opacity-70" />

      <div className="mb-5 flex items-start justify-between gap-4">
        <PostMeta category={post.category} publishedAt={post.createdAt} tags={post.tags.slice(0, 2)} />

        <div className="rounded-full border border-[var(--border)] bg-[var(--surface-alt)] px-3 py-1 text-xs text-[var(--muted)]">
          {hasExcerpt ? '摘要' : '正文片段'}
        </div>
      </div>

      <Link href={`/posts/${post.slug}`} className="block cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
        <h2 className="text-balance text-2xl font-black leading-tight tracking-[-0.03em] text-[var(--foreground)] transition-colors group-hover:text-[var(--brand)]">
          {highlightText(post.title, query)}
        </h2>
      </Link>

      <p className="mt-3 text-sm text-[var(--muted)]">作者 {post.author.name ?? '匿名作者'} · 结果已保留原始内容片段，便于快速判断相关性。</p>

      <div className="mt-5 rounded-2xl border border-dashed border-[var(--border)] bg-[color:color-mix(in_srgb,var(--surface)_82%,var(--brand)_18%)] p-4 text-sm leading-7 text-[var(--foreground)]">
        {highlightText(snippet, query)}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4" />
            {post._count.comments} 评论
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" />
            {post.viewCount ?? 0} 浏览
          </span>
        </div>

        <Link
          href={`/posts/${post.slug}`}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1.5 font-medium text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
        >
          查看文章
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  )
}
