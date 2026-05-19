'use client'

import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, ChevronRight, Clock3, Eye } from 'lucide-react'
import { FallbackImage } from '@/components/ui'
import { motion } from "motion/react";
import { listContainerVariants, revealVariants } from "@/components/motion/variants";

const READER_CARD_FALLBACK_SRC = '/images/fuwari-post-cover-fallback.svg'

interface HomeLatestPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  createdAt: Date | string
  coverImage?: string | null
  readingTimeMinutes?: number
  viewCount?: number
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
      <h2 id="home-latest-title" className="reader-section-heading">
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
      <div className="flex items-center justify-between gap-4">
        <h2 id="home-latest-title" className="reader-section-heading">
          最新文章
        </h2>
        <Link href="/posts" className="reader-link inline-flex items-center gap-1 text-xs font-bold">
          查看全部文章
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <motion.div
        className="space-y-3"
        variants={listContainerVariants}
        initial="hidden"
        animate="visible"
      >
        {posts.slice(0, 4).map((post) => {
          return (
            <motion.article
              key={post.id}
              className="reader-feed-card group grid min-w-0 gap-4 p-3 sm:min-h-32 sm:grid-cols-[10.75rem_minmax(0,1fr)_2.25rem] sm:grid-rows-[minmax(0,1fr)] sm:p-3"
              variants={revealVariants}
            >
              <Link
                href={`/posts/${post.slug}`}
                aria-label={`阅读 ${post.title}`}
                className="theme-media relative aspect-[1.65] overflow-hidden rounded-lg sm:h-full sm:aspect-auto"
              >
                {post.coverImage ? (
                  <FallbackImage
                    alt={post.title}
                    className="theme-media-image object-cover"
                    fill
                    loading="lazy"
                    quality={70}
                    sizes="(min-width: 1800px) 14rem, (max-width: 640px) 100vw, 10rem"
                    src={post.coverImage}
                    fallbackSrc={READER_CARD_FALLBACK_SRC}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-[var(--reader-panel-muted)]">
                    <BookOpen className="h-12 w-12 text-[var(--text-faint)] opacity-35" aria-hidden="true" />
                  </div>
                )}
              </Link>

              <div className="min-w-0 self-center space-y-2.5">
                {post.category ? (
                  <Link href={`/categories/${post.category.slug}`} className="reader-chip rounded-md px-2 py-1 text-[0.68rem]">
                    {post.category.name}
                  </Link>
                ) : null}

                <Link href={`/posts/${post.slug}`} className="block min-w-0">
                  <h3 className="line-clamp-2 text-lg font-extrabold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)] md:text-xl">
                    {post.title}
                  </h3>
                </Link>

                <p className="line-clamp-2 text-sm leading-6 text-[var(--text-body)]">{post.excerpt ?? '暂无摘要'}</p>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-[var(--accent-sky)]" aria-hidden="true" />
                    {new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
                    {post.readingTimeMinutes ?? 10} 分钟
                  </span>
                  {(post.viewCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5 text-[var(--text-faint)]" aria-hidden="true" />
                      {post.viewCount} 浏览
                    </span>
                  ) : null}
                </div>
              </div>

              <Link
                href={`/posts/${post.slug}`}
                aria-label={`继续阅读 ${post.title}`}
                className="reader-card-action hidden self-stretch justify-self-end sm:inline-flex"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </Link>
            </motion.article>
          )
        })}
      </motion.div>

    </section>
  )
}
