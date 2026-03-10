'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { hasReachedScrollThreshold } from './scroll-threshold'

interface PaginationState {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: PaginationState
}

interface UseInfinitePostsOptions<T extends { id: string }> {
  initialPosts: T[]
  initialPagination: PaginationState
  buildUrl: (page: number) => string
  resetKey?: string
}

export function useInfinitePosts<T extends { id: string }>({
  initialPosts,
  initialPagination,
  buildUrl,
  resetKey,
}: UseInfinitePostsOptions<T>) {
  const [posts, setPosts] = useState(initialPosts)
  const [pagination, setPagination] = useState(initialPagination)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedPagesRef = useRef(new Set<number>([initialPagination.page]))

  useEffect(() => {
    setPosts(initialPosts)
    setPagination(initialPagination)
    setIsLoading(false)
    setError(null)
    loadedPagesRef.current = new Set([initialPagination.page])
  }, [
    initialPosts,
    initialPagination.page,
    initialPagination.limit,
    initialPagination.total,
    initialPagination.totalPages,
    resetKey,
  ])

  const hasNextPage = useMemo(
    () => pagination.page < pagination.totalPages,
    [pagination.page, pagination.totalPages],
  )

  const loadNextPage = useCallback(async () => {
    if (!hasNextPage || isLoading) {
      return
    }

    const nextPage = pagination.page + 1

    if (loadedPagesRef.current.has(nextPage)) {
      return
    }

    loadedPagesRef.current.add(nextPage)
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(buildUrl(nextPage))

      if (!response.ok) {
        throw new Error('Failed to load posts')
      }

      const payload = (await response.json()) as PaginatedResponse<T>

      setPosts((currentPosts) => {
        const seenIds = new Set(currentPosts.map((post) => post.id))
        const nextPosts = payload.data.filter((post) => !seenIds.has(post.id))
        return [...currentPosts, ...nextPosts]
      })
      setPagination(payload.pagination)
    } catch {
      loadedPagesRef.current.delete(nextPage)
      setError('加载更多文章失败，请稍后重试。')
    } finally {
      setIsLoading(false)
    }
  }, [buildUrl, hasNextPage, isLoading, pagination.page])

  useEffect(() => {
    if (!hasNextPage) {
      return
    }

    const handleScroll = () => {
      if (
        hasReachedScrollThreshold({
          scrollTop: window.scrollY,
          clientHeight: window.innerHeight,
          scrollHeight: document.documentElement.scrollHeight,
        })
      ) {
        void loadNextPage()
      }
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [hasNextPage, loadNextPage])

  return {
    posts,
    pagination,
    isLoading,
    error,
    hasNextPage,
    loadNextPage,
  }
}
