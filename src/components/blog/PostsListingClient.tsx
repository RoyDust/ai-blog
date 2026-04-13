'use client'

import Link from 'next/link'
import { useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

import { FilterBar } from './FilterBar'
import { getListRevealAnimationProps } from './listAnimation'
import { PostCard } from './PostCard'
import { PostCardFeatured } from './PostCardFeatured'
import { PostCardSkeleton } from './PostCardSkeleton'
import { useInfinitePosts } from './useInfinitePosts'

interface ListingPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  createdAt: Date | string
  coverImage?: string | null
  author: { id: string; name: string | null; image: string | null }
  category: { id?: string; name: string; slug: string } | null
  tags: Array<{ id?: string; name: string; slug: string }>
  _count: { comments: number; likes: number }
  viewCount?: number
}

interface ListingOption {
  name: string
  slug: string
}

interface PostsListingClientProps {
  initialPosts: ListingPost[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  categories: ListingOption[]
  tags: ListingOption[]
}

export function PostsListingClient({ initialPosts, initialPagination, categories, tags }: PostsListingClientProps) {
  const searchParams = useSearchParams()
  const search = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')?.trim() ?? ''
  const tag = searchParams.get('tag')?.trim() ?? ''

  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(initialPagination.limit),
      })

      if (search) {
        params.set('search', search)
      }

      if (category) {
        params.set('category', category)
      }

      if (tag) {
        params.set('tag', tag)
      }

      return `/api/posts?${params.toString()}`
    },
    [category, initialPagination.limit, search, tag],
  )

  const { posts, pagination, isLoading, error, hasNextPage, observerTargetRef } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl,
    loadFirstPageOnMount: true,
    resetKey: `${search}|${category}|${tag}`,
  })

  const isInitialLoading = isLoading && posts.length === 0
  const visibleTotal = isInitialLoading ? '加载中…' : String(pagination.total)

  return (
    <div className="space-y-6">
      <header className="card-base space-y-5 p-6 md:p-8">
        <nav aria-label="Breadcrumb" className="text-50 text-sm">
          <Link href="/">首页</Link>
          <span className="mx-2">/</span>
          <span>文章</span>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="ui-kicker">浏览</p>
            <h1 className="text-90 font-display text-3xl font-bold md:text-4xl">文章索引</h1>
            <p className="text-75 max-w-[42rem] text-sm leading-7">按主题、标签和关键词探索全部内容。</p>
          </div>
          <div className="rounded-2xl bg-[var(--surface-alt)] px-4 py-3 text-sm text-[var(--text-body)]">
            共 {visibleTotal} 篇文章
          </div>
        </div>
      </header>

      <FilterBar category={category} categories={categories} search={search} tag={tag} tags={tags} />

      <div className="space-y-4">
        {isInitialLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`skeleton-${index}`}>
              <PostCardSkeleton />
            </div>
          ))
        ) : posts.length > 0 ? (
          <>
            <PostCardFeatured post={posts[0]} />
            {posts.slice(1).map((post, index) => (
              <div key={post.id} {...getListRevealAnimationProps(index)}>
                <PostCard post={post} />
              </div>
            ))}
          </>
        ) : (
          <div className="card-base p-8 text-sm text-[var(--muted)]">未找到匹配内容，请尝试调整筛选条件。</div>
        )}

        {!isInitialLoading && isLoading && <div className="px-2 py-4 text-sm text-[var(--muted)]">正在加载下一页...</div>}
        {error && <div className="px-2 py-2 text-sm text-red-500">{error}</div>}
        {hasNextPage && <div ref={observerTargetRef} aria-hidden="true" className="h-4 w-full" />}
        {!hasNextPage && posts.length > 0 && pagination.totalPages > 1 && (
          <div className="px-2 py-2 text-sm text-[var(--muted)]">已加载全部文章</div>
        )}
      </div>
    </div>
  )
}
