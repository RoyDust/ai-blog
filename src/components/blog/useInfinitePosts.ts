'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import useSWRInfinite from 'swr/infinite'

import { apiFetcher, toErrorMessage } from '@/lib/client-api'

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

type InfinitePostsKey = readonly [scope: string, resetKey: string, url: string]
const initialPageKey = '__initial_posts_page__'

/**
 * 前台文章无限滚动（useSWRInfinite 内核）。
 *
 * 对外 API 与旧实现保持一致：首屏可由 RSC 提供；筛选变化时由 SWR key
 * 隔离缓存并重置分页；IntersectionObserver 只负责请求下一页。
 */
export function useInfinitePosts<T extends { id: string }>({
  initialPosts,
  initialPagination,
  buildUrl,
  resetKey = '',
  loadFirstPageOnMount = false,
}: UseInfinitePostsOptions<T>) {
  const cacheScope = useId()
  const [propsVersion, setPropsVersion] = useState(0)
  const [previousProps, setPreviousProps] = useState<{ posts: T[]; page: number; total: number; resetKey: string }>({
    posts: initialPosts,
    page: initialPagination.page,
    total: initialPagination.total,
    resetKey,
  })
  const initialPage = useMemo<PaginatedResponse<T>>(
    () => ({ data: initialPosts, pagination: initialPagination }),
    [initialPosts, initialPagination],
  )

  if (
    previousProps.posts !== initialPosts ||
    previousProps.page !== initialPagination.page ||
    previousProps.total !== initialPagination.total ||
    previousProps.resetKey !== resetKey
  ) {
    setPreviousProps({
      posts: initialPosts,
      page: initialPagination.page,
      total: initialPagination.total,
      resetKey,
    })
    setPropsVersion((value) => value + 1)
  }

  const getKey = useCallback(
    (pageIndex: number, previousPageData: PaginatedResponse<T> | null): InfinitePostsKey | null => {
      if (previousPageData && previousPageData.pagination.page >= previousPageData.pagination.totalPages) {
        return null
      }

      if (!loadFirstPageOnMount && pageIndex === 0) {
        return [cacheScope, `${resetKey}:${propsVersion}`, initialPageKey]
      }

      const page = loadFirstPageOnMount ? pageIndex + 1 : initialPagination.page + pageIndex
      return [cacheScope, `${resetKey}:${propsVersion}`, buildUrl(page)]
    },
    [buildUrl, cacheScope, initialPagination.page, loadFirstPageOnMount, propsVersion, resetKey],
  )
  const fetchPage = useCallback(
    ([, , url]: InfinitePostsKey) => {
      if (url === initialPageKey) {
        return Promise.resolve(initialPage)
      }

      return apiFetcher<PaginatedResponse<T>>(url)
    },
    [initialPage],
  )

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
    setSize,
  } = useSWRInfinite<PaginatedResponse<T>, Error, typeof getKey>(
    getKey,
    fetchPage,
    {
      fallbackData: loadFirstPageOnMount ? undefined : [initialPage],
      keepPreviousData: false,
      parallel: false,
      persistSize: false,
      revalidateFirstPage: false,
      revalidateOnFocus: false,
      revalidateOnMount: loadFirstPageOnMount,
    },
  )

  const pages = useMemo(() => data ?? [], [data])
  const latestPagination = pages[pages.length - 1]?.pagination ?? initialPagination
  const hasNextPage = latestPagination.page < latestPagination.totalPages

  const posts = useMemo(() => {
    const seenIds = new Set<string>()
    const merged: T[] = []

    for (const page of pages) {
      for (const post of page.data) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id)
          merged.push(post)
        }
      }
    }

    return merged
  }, [pages])

  const observerTargetRef = useRef<HTMLDivElement | null>(null)
  const errorMessage = error ? toErrorMessage(error, '加载更多文章失败，请稍后重试。') : null

  const loadNextPage = useCallback(async () => {
    if (error) {
      await mutate()
      return
    }

    if (!hasNextPage || isLoading || isValidating) {
      return
    }

    await setSize((currentSize) => currentSize + 1)
  }, [error, hasNextPage, isLoading, isValidating, mutate, setSize])

  useEffect(() => {
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
  }, [loadNextPage])

  return {
    posts,
    pagination: latestPagination,
    isLoading: isLoading || isValidating,
    error: errorMessage,
    hasNextPage,
    observerTargetRef,
    loadNextPage,
  }
}
