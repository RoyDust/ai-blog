import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { FallbackImage } from '@/components/ui'
import { formatIsoDate, formatMonthDay, formatYear } from '@/lib/editorial-format'
import { shimmerBlurDataURL } from '@/lib/image-placeholder'
import { getPostViewTransitionName } from '@/lib/view-transition'

const SEARCH_RESULT_FALLBACK_SRC = '/images/fuwari-post-cover-fallback.svg'

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
          className="rounded-[2px] bg-[var(--ed-highlight)] px-0.5 text-[var(--foreground)]"
        >
          {part}
        </mark>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

const countFormatter = new Intl.NumberFormat('en-US')

/**
 * 搜索结果行（README 第 11 节）：沿用全站列表行（简报 16.1），单列；
 * 标题和片段里的命中词用 sky 24% 底色标出。meta 全是文字：
 * 分类 · 首个标签 · 片段来源 · 阅读 · 评论 · 点赞。
 */
export function SearchResultCard({ post, query }: SearchResultCardProps) {
  const hasExcerpt = Boolean(post.excerpt?.trim())
  const snippet = buildSnippet(post, query)
  const firstTag = post.tags[0]
  const isoDate = formatIsoDate(post.createdAt)

  // meta 全是文字：分类 · 首个标签 · 片段来源 · 阅读 · 评论 · 点赞；手机上去掉 #标签（README 第 16 节）
  const metaItems: Array<{ key: string; node: ReactNode; mobileHidden?: boolean }> = []
  if (post.category) {
    metaItems.push({
      key: 'category',
      node: (
        <Link className="ed-tag text-[0.75rem]" href={`/categories/${post.category.slug}`}>
          {post.category.name}
        </Link>
      ),
    })
  }
  if (firstTag) {
    metaItems.push({
      key: 'tag',
      mobileHidden: true,
      node: (
        <Link className="ed-tag text-[0.75rem]" href={`/tags/${firstTag.slug}`}>
          #{firstTag.name}
        </Link>
      ),
    })
  }
  metaItems.push({ key: 'source', node: <span>{hasExcerpt ? '摘要' : '正文片段'}</span> })
  if (typeof post.viewCount === 'number') {
    metaItems.push({
      key: 'views',
      node: (
        <span>
          阅读 <span className="ed-mono">{countFormatter.format(post.viewCount)}</span>
        </span>
      ),
    })
  }
  metaItems.push(
    {
      key: 'comments',
      node: (
        <span>
          评论 <span className="ed-mono">{countFormatter.format(post._count.comments)}</span>
        </span>
      ),
    },
    {
      key: 'likes',
      node: (
        <span>
          点赞 <span className="ed-mono">{countFormatter.format(post._count.likes)}</span>
        </span>
      ),
    },
  )

  return (
    <article className="ed-row group" data-testid="search-result-row">
      <div className="ed-row__date ed-row__date--desktop">
        <time className="flex flex-col" dateTime={isoDate}>
          <span>{formatYear(post.createdAt)}</span>
          <span>{formatMonthDay(post.createdAt)}</span>
        </time>
      </div>

      <div className="min-w-0">
        <h3 className="ed-row__title line-clamp-2" style={{ viewTransitionName: getPostViewTransitionName('title', post.slug) }}>
          <Link className="ed-row__link" href={`/posts/${post.slug}`}>
            {highlightText(post.title, query)}
          </Link>
        </h3>
        <p className="ed-row__excerpt line-clamp-2">{highlightText(snippet, query)}</p>
        <p className="ed-row__meta ed-meta flex flex-wrap items-baseline">
          {/* 手机上没有日期列，日期并入 meta 开头（README 第 16 节） */}
          <span className="ed-mono sm:hidden">{isoDate}</span>
          {metaItems.map((item, index) => (
            <span key={item.key} className={cn('inline-flex items-baseline', item.mobileHidden && 'max-sm:hidden')}>
              <span aria-hidden="true" className={cn('ed-meta-sep', index === 0 && 'sm:hidden')}>
                ·
              </span>
              {item.node}
            </span>
          ))}
        </p>
      </div>

      {post.coverImage ? (
        <div className="ed-row__thumb" style={{ viewTransitionName: getPostViewTransitionName('cover', post.slug) }}>
          <FallbackImage
            alt=""
            aria-hidden="true"
            blurDataURL={shimmerBlurDataURL}
            className="object-cover"
            fallbackSrc={SEARCH_RESULT_FALLBACK_SRC}
            fill
            loading="lazy"
            placeholder="blur"
            quality={70}
            sizes="(max-width: 640px) 6.5rem, 7.5rem"
            src={post.coverImage}
          />
        </div>
      ) : (
        <div aria-hidden="true" />
      )}
    </article>
  )
}
