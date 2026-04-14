'use client'

import { useCallback } from 'react'

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
  featured: boolean
  createdAt: Date | string
  coverImage?: string | null
  author: { id: string; name: string | null; image: string | null }
  category: { id?: string; name: string; slug: string } | null
  tags: Array<{ id?: string; name: string; slug: string }>
  _count: { comments: number; likes: number }
  viewCount?: number
}

interface PostsListingClientProps {
  initialPosts: ListingPost[]
  initialPagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function PostsListingClient({ initialPosts, initialPagination }: PostsListingClientProps) {
  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(initialPagination.limit),
      })
      return `/api/posts?${params.toString()}`
    },
    [initialPagination.limit],
  )

  const { posts, pagination, isLoading, error, hasNextPage, observerTargetRef } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl,
    loadFirstPageOnMount: true,
    resetKey: 'all',
  })

  const isInitialLoading = isLoading && posts.length === 0

  return (
    <div className="space-y-4">
      {isInitialLoading ? (
        Array.from({ length: 6 }).map((_, index) => (
          <div key={`skeleton-${index}`}>
            <PostCardSkeleton />
          </div>
        ))
      ) : posts.length > 0 ? (
        <>
          {posts.map((post, index) => (
            <div key={post.id} {...getListRevealAnimationProps(index)}>
              {post.featured ? <PostCardFeatured post={post} /> : <PostCard post={post} />}
            </div>
          ))}
        </>
      ) : (
        <div className="card-base p-8 text-sm text-muted">暂无文章。</div>
      )}

      {!isInitialLoading && isLoading && <div className="px-2 py-4 text-sm text-muted">正在加载下一页...</div>}
      {error && <div className="px-2 py-2 text-sm text-red-500">{error}</div>}
      {hasNextPage && <div ref={observerTargetRef} aria-hidden="true" className="h-4 w-full" />}
      {!hasNextPage && posts.length > 0 && pagination.totalPages > 1 && (
        <div className="px-2 py-2 text-sm text-muted">已加载全部文章</div>
      )}
    </div>
  )
}
