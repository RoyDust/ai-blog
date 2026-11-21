'use client'

/**
 * 前台文章列表客户端增强层（方向 A，简报 16.3）。
 *
 * 职责：
 * - 在服务端首屏数据之上接管无限滚动加载
 * - 第一页、无筛选、首篇为精选时，首篇用置顶精选展示；其余精选只在 meta 开头写「精选」
 * - 处理首屏骨架、加载下一页（2 行骨架）、已显示全部、空态与错误重试
 */

import { useCallback } from 'react'

import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { EmptyState, ListRowSkeleton, TextLink } from '@/components/editorial'
import { editorialEase } from '@/components/editorial/motion'
import { PostCard, type PostCardPost } from './PostCard'
import { PostCardFeatured } from './PostCardFeatured'
import { useInfinitePosts } from './useInfinitePosts'

type ListingPost = PostCardPost & {
  excerpt: string | null
  featured: boolean
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

function scrollToTop() {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
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
  const hasFilters = Boolean(categoryFilter || tagFilter || searchFilter)
  const reduce = useReducedMotion()

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

  const { posts, pagination, isLoading, error, hasNextPage, observerTargetRef, loadNextPage } = useInfinitePosts({
    initialPosts,
    initialPagination,
    buildUrl,
    loadFirstPageOnMount: initialPagination.page === 0,
    resetKey,
  })

  const isInitialLoading = isLoading && posts.length === 0
  const pinnedPost = !hasFilters && posts[0]?.featured ? posts[0] : null
  const rowPosts = pinnedPost ? posts.slice(1) : posts

  return (
    <div data-testid="posts-listing" aria-busy={isLoading}>
      {isInitialLoading ? (
        // 首屏骨架不画置顶精选：加载前不知道有没有精选
        <ListRowSkeleton count={4} />
      ) : posts.length > 0 ? (
        <>
          {pinnedPost ? (
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: editorialEase }}
            >
              <PostCardFeatured post={pinnedPost} />
            </motion.div>
          ) : null}
          <div>
            <AnimatePresence initial={!reduce}>
              {rowPosts.map((post, index) => (
                <motion.div
                  key={post.id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: editorialEase, delay: Math.min(index % initialPagination.limit, 8) * 0.04 }}
                >
                  <PostCard post={post} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : !error ? (
        <EmptyState
          role="status"
          title={hasFilters ? '这个筛选下还没有文章' : '还没有发布文章'}
          actions={hasFilters ? <TextLink href="/posts">清空筛选</TextLink> : <TextLink href="/">回到首页</TextLink>}
        />
      ) : null}

      {!isInitialLoading && isLoading && !error ? <ListRowSkeleton count={2} label="正在加载下一页" /> : null}

      <AnimatePresence>
        {error ? (
          <motion.div
            key="error"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: editorialEase }}
          >
            <EmptyState
              role="alert"
              tone="danger"
              title={posts.length > 0 ? error : '文章加载失败，请稍后重试'}
              actions={
                <button className="ed-btn-outline" type="button" onClick={() => void loadNextPage()}>
                  重试
                </button>
              }
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {hasNextPage && <div ref={observerTargetRef} aria-hidden="true" className="h-4 w-full" />}

      {!hasNextPage && !isLoading && posts.length > 0 && pagination.totalPages > 1 ? (
        <p className="flex flex-wrap items-center justify-center gap-x-2 py-6 text-[0.875rem] text-[var(--text-muted)]">
          <span>
            已显示全部 <span className="ed-mono">{pagination.total}</span> 篇
          </span>
          <span aria-hidden="true">·</span>
          <button className="ed-link" type="button" onClick={scrollToTop}>
            <span>回到顶部</span>
            <span aria-hidden="true" className="ed-link__arrow ed-link__arrow--right">
              →
            </span>
          </button>
        </p>
      ) : null}
    </div>
  )
}
