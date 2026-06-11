'use client'

/**
 * 前台文章列表客户端增强层。
 *
 * 职责：
 * - 在服务端首屏数据之上接管无限滚动加载
 * - 根据文章类型选择普通卡片或精选卡片展示
 * - 处理加载中、错误态与“已加载全部”提示
 */

import { useCallback } from 'react'

import { AnimatePresence, motion } from "motion/react";
import { featuredPostRevealVariants, postCardRevealVariants, postListContainerVariants } from "@/components/motion/variants";
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
  filters?: {
    category?: string
    tag?: string
    search?: string
  }
}

/**
 * 文章列表客户端容器。
 * buildUrl 定义了翻页 API 规则，具体的分页状态与观察器逻辑交给 useInfinitePosts。
 */
export function PostsListingClient({ initialPosts, initialPagination, filters }: PostsListingClientProps) {
  const categoryFilter = filters?.category
  const tagFilter = filters?.tag
  const searchFilter = filters?.search
  const resetKey = JSON.stringify(filters ?? {})

  const buildUrl = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(initialPagination.limit),
      })

      if (categoryFilter) params.set('category', categoryFilter)
      if (tagFilter) params.set('tag', tagFilter)
      if (searchFilter) {
        params.set('q', searchFilter)
        params.set('search', searchFilter)
      }

      return `/api/posts?${params.toString()}`
    },
    [categoryFilter, initialPagination.limit, searchFilter, tagFilter],
  )

  const { posts, pagination, isLoading, error, hasNextPage, observerTargetRef } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl,
    loadFirstPageOnMount: initialPagination.page === 0,
    resetKey,
  })

  const isInitialLoading = isLoading && posts.length === 0

  return (
    <div className="reader-section" data-testid="posts-listing">
      {isInitialLoading ? (
        Array.from({ length: 6 }).map((_, index) => (
          <div key={`skeleton-${index}`}>
            <PostCardSkeleton />
          </div>
        ))
      ) : posts.length > 0 ? (
        <motion.div
          variants={postListContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* 不设 initial={false}：presence 首挂载抑制会吞掉容器 stagger 入场 */}
          <AnimatePresence mode="popLayout">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                layout
                variants={post.featured ? featuredPostRevealVariants : postCardRevealVariants}
              >
                {post.featured ? <PostCardFeatured post={post} /> : <PostCard post={post} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="reader-panel p-8 text-sm text-[var(--text-muted)]">暂无文章。</div>
      )}

      {!isInitialLoading && isLoading && (
        <div className="reader-panel px-5 py-4 text-sm text-[var(--text-muted)]">正在加载下一页...</div>
      )}
      {error && (
        <div
          role="alert"
          className="reader-panel border-[var(--danger-border)] px-5 py-4 text-sm text-[var(--danger-foreground)]"
        >
          {error}
        </div>
      )}
      {hasNextPage && <div ref={observerTargetRef} aria-hidden="true" className="h-4 w-full" />}
      {!hasNextPage && posts.length > 0 && pagination.totalPages > 1 && (
        <div className="px-2 py-2 text-center text-sm text-[var(--text-faint)]">已加载全部文章</div>
      )}
    </div>
  )
}
