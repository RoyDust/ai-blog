'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  loadFirstPageOnMount?: boolean
}

export function useInfinitePosts<T extends { id: string }>({
  initialPosts,
  initialPagination,
  buildUrl,
  resetKey,
  loadFirstPageOnMount = false,
}: UseInfinitePostsOptions<T>) {
  const [posts, setPosts] = useState(initialPosts)
  const [pagination, setPagination] = useState(initialPagination)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedPagesRef = useRef(new Set<number>(initialPagination.page > 0 ? [initialPagination.page] : []))
  const observerTargetRef = useRef<HTMLDivElement | null>(null)
  const requestIdRef = useRef(0)

  const fetchPage = useCallback(
    async ({ page, mode }: { page: number; mode: 'replace' | 'append' }) => {
      const requestId = ++requestIdRef.current

      if (mode === 'replace') {
        loadedPagesRef.current = new Set()
        setPosts([])
        setPagination((currentPagination) => ({
          page: 0,
          limit: currentPagination.limit,
          total: 0,
          totalPages: 0,
        }))
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl(page))

        if (!response.ok) {
          throw new Error('Failed to load posts')
        }

        const payload = (await response.json()) as PaginatedResponse<T>

        if (requestId !== requestIdRef.current) {
          return
        }

        setPosts((currentPosts) => {
          if (mode === 'replace') {
            return payload.data
          }

          const seenIds = new Set(currentPosts.map((post) => post.id))
          const nextPosts = payload.data.filter((post) => !seenIds.has(post.id))
          return [...currentPosts, ...nextPosts]
        })
        setPagination(payload.pagination)

        if (mode === 'replace') {
          loadedPagesRef.current = new Set([payload.pagination.page])
        } else {
          loadedPagesRef.current.add(page)
        }
      } catch {
        if (mode === 'append') {
          loadedPagesRef.current.delete(page)
        }

        if (requestId === requestIdRef.current) {
          setError('加载更多文章失败，请稍后重试。')
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false)
        }
      }
    },
    [buildUrl],
  )

  useEffect(() => {
    if (loadFirstPageOnMount) {
      void fetchPage({ page: 1, mode: 'replace' })
      return
    }

    setPosts(initialPosts)
    setPagination(initialPagination)
    setIsLoading(false)
    setError(null)
    loadedPagesRef.current = new Set(initialPagination.page > 0 ? [initialPagination.page] : [])
  }, [
    fetchPage,
    initialPosts,
    initialPagination.page,
    initialPagination.limit,
    initialPagination.total,
    initialPagination.totalPages,
    loadFirstPageOnMount,
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
    await fetchPage({ page: nextPage, mode: 'append' })
  }, [fetchPage, hasNextPage, isLoading, pagination.page])

  useEffect(() => {
    if (!hasNextPage || isLoading) {
      return
    }

    const target = observerTargetRef.current

    if (!target || typeof IntersectionObserver === 'undefined') {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage()
        }
      },
      { rootMargin: '160px 0px' },
    )

    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [hasNextPage, isLoading, loadNextPage])

  return {
    posts,
    pagination,
    isLoading,
    error,
    hasNextPage,
    observerTargetRef,
    loadNextPage,
  }
}
