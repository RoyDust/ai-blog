'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Clock3 } from 'lucide-react'
import { FallbackImage } from '@/components/ui'
import { getListRevealAnimationProps } from './listAnimation'

interface HomeLatestPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  createdAt: Date | string
  coverImage?: string | null
  readingTimeMinutes?: number
  author: { id: string; name: string | null; image: string | null }
  category: { id?: string; name: string; slug: string } | null
  tags: Array<{ id?: string; name: string; slug: string }>
  _count: { comments: number; likes: number }
}

interface HomeLatestPostsProps {
  posts: HomeLatestPost[]
}

export function HomeLatestPosts({ posts }: HomeLatestPostsProps) {
  if (posts.length === 0) {
    return (
      <section className="reader-section" aria-labelledby="home-latest-title">
        <h2 id="home-latest-title" className="text-xl font-bold text-[var(--foreground)]">
          最新文章
        </h2>

        <div className="reader-feed-card p-5 md:p-6">
          <div className="flex flex-col gap-3 text-sm leading-7 text-[var(--text-body)]">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--reader-border)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)]">
              <Clock3 className="h-4 w-4 text-[var(--accent-warm)]" aria-hidden="true" />
              Waiting for notes
            </span>
            <p>最新文章区会保留当前位置，避免首页在空数据时突然塌陷。</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="reader-section" aria-labelledby="home-latest-title">
      <h2 id="home-latest-title" className="text-xl font-bold text-[var(--foreground)] md:text-[1.35rem]">
        最新文章
      </h2>

      <div className="space-y-3">
        {posts.slice(0, 3).map((post, index) => {
          const revealProps = getListRevealAnimationProps(index)

          return (
            <article
              key={post.id}
              className={`reader-feed-card group grid min-w-0 gap-4 p-3 sm:h-40 sm:grid-cols-[10rem_minmax(0,1fr)_6.25rem_2.25rem] sm:grid-rows-[minmax(0,1fr)] sm:p-4 ${revealProps.className ?? ''}`}
              style={revealProps.style}
            >
              <Link
                href={`/posts/${post.slug}`}
                aria-label={`阅读 ${post.title}`}
                className="theme-media relative aspect-[1.65] overflow-hidden rounded-[calc(var(--radius-large)-0.25rem)] sm:h-full sm:aspect-auto"
              >
                {post.coverImage ? (
                  <FallbackImage
                    alt={post.title}
                    className="theme-media-image object-cover"
                    fill
                    loading="lazy"
                    quality={72}
                    sizes="(max-width: 640px) 100vw, 10rem"
                    src={post.coverImage}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--reader-panel-muted)]">
                    <BookOpen className="h-12 w-12 text-[var(--text-faint)] opacity-35" aria-hidden="true" />
                  </div>
                )}
              </Link>

              <div className="min-w-0 self-center space-y-2.5">
                {post.category ? (
                  <Link href={`/categories/${post.category.slug}`} className="reader-chip px-2.5 py-1 text-[0.7rem]">
                    {post.category.name}
                  </Link>
                ) : null}

                <Link href={`/posts/${post.slug}`} className="block min-w-0">
                  <h3 className="line-clamp-1 text-lg font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] md:text-xl">
                    {post.title}
                  </h3>
                </Link>

                <p className="line-clamp-2 text-sm leading-6 text-[var(--text-body)]">{post.excerpt ?? '暂无摘要'}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-center text-xs text-[var(--text-muted)] sm:flex-col sm:items-start sm:justify-center sm:gap-2">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {new Date(post.createdAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  {post.readingTimeMinutes ?? 10} 分钟
                </span>
              </div>

              <Link
                href={`/posts/${post.slug}`}
                aria-label={`继续阅读 ${post.title}`}
                className="reader-icon-btn hidden h-9 w-9 self-center justify-self-end sm:inline-flex"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </article>
          )
        })}
      </div>

      <Link href="/posts" className="reader-link mx-auto inline-flex items-center gap-2 text-sm font-semibold">
        查看更多文章
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}
