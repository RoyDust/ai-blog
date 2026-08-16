import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { mutate as clearSwrCache } from 'swr'

import { useInfinitePosts } from '../useInfinitePosts'

const initialPosts = [
  {
    id: '1',
    title: 'First post',
    slug: 'first-post',
    excerpt: 'First excerpt',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    author: { id: 'u1', name: 'Author', image: null },
    category: { name: 'Tech', slug: 'tech' },
    tags: [{ name: 'Next', slug: 'next' }],
    _count: { comments: 1, likes: 2 },
  },
]

const nextPagePosts = [
  {
    id: '2',
    title: 'Second post',
    slug: 'second-post',
    excerpt: 'Second excerpt',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    author: { id: 'u1', name: 'Author', image: null },
    category: { name: 'Tech', slug: 'tech' },
    tags: [{ name: 'React', slug: 'react' }],
    _count: { comments: 3, likes: 4 },
  },
]

let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | undefined

class MockIntersectionObserver {
  constructor(callback: (entries: Array<{ isIntersecting: boolean }>) => void) {
    intersectionCallback = callback
  }

  observe() {}
  disconnect() {}
  unobserve() {}
}

function Harness({
  initialPagination = {
    page: 1,
    limit: 1,
    total: 2,
    totalPages: 2,
  },
  initialPosts: seedPosts = initialPosts,
  loadFirstPageOnMount = false,
  resetKey,
}: {
  initialPagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  initialPosts?: typeof initialPosts
  loadFirstPageOnMount?: boolean
  resetKey?: string
}) {
  const buildUrl = React.useCallback((page: number) => `/api/posts?page=${page}&limit=1`, [])

  const { posts, isLoading, observerTargetRef } = useInfinitePosts({
    initialPosts: seedPosts,
    initialPagination,
    buildUrl,
    loadFirstPageOnMount,
    resetKey,
  })

  return (
    <div>
      <div>{isLoading ? 'loading' : 'idle'}</div>
      {posts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
      <div ref={observerTargetRef} />
    </div>
  )
}

describe('useInfinitePosts', () => {
  beforeEach(async () => {
    intersectionCallback = undefined
    // @ts-expect-error test shim
    globalThis.IntersectionObserver = MockIntersectionObserver
    await clearSwrCache(() => true, undefined, { revalidate: false })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('loads the next page when the observer target enters the viewport', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: nextPagePosts,
          pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
        }),
      }),
    )

    render(<Harness />)

    expect(screen.getByText('First post')).toBeInTheDocument()
    expect(screen.queryByText('Second post')).not.toBeInTheDocument()

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }])
    })

    await waitFor(() => {
      expect(screen.getByText('Second post')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith('/api/posts?page=2&limit=1')
  })

  test('does not load the next page before the observer target intersects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: nextPagePosts,
          pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
        }),
      }),
    )

    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByText('First post')).toBeInTheDocument()
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('Second post')).not.toBeInTheDocument()
  })

  test('loads multiple pages and removes duplicate posts by id', async () => {
    const duplicatePost = { ...nextPagePosts[0], title: 'Second post duplicate' }
    const thirdPagePost = { ...nextPagePosts[0], id: '3', title: 'Third post', slug: 'third-post' }

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [duplicatePost],
            pagination: { page: 2, limit: 1, total: 3, totalPages: 3 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [thirdPagePost],
            pagination: { page: 3, limit: 1, total: 3, totalPages: 3 },
          }),
        }),
    )

    render(
      <Harness
        initialPagination={{
          page: 1,
          limit: 1,
          total: 3,
          totalPages: 3,
        }}
      />,
    )

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }])
    })

    await waitFor(() => {
      expect(screen.getByText('Second post duplicate')).toBeInTheDocument()
    })

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }])
    })

    await waitFor(() => {
      expect(screen.getByText('Third post')).toBeInTheDocument()
    })

    expect(screen.getAllByText(/Second post/)).toHaveLength(1)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/posts?page=2&limit=1')
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/posts?page=3&limit=1')
  })

  test('keeps loaded posts visible while a later page is still pending', async () => {
    let resolveSecondPage: ((value: unknown) => void) | undefined
    const secondPageResponse = new Promise((resolve) => {
      resolveSecondPage = resolve
    })

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: initialPosts,
            pagination: { page: 1, limit: 1, total: 2, totalPages: 2 },
          }),
        })
        .mockReturnValueOnce(secondPageResponse),
    )

    render(
      <Harness
        initialPagination={{ page: 0, limit: 1, total: 0, totalPages: 0 }}
        initialPosts={[]}
        loadFirstPageOnMount
      />,
    )

    await screen.findByText('First post')

    act(() => {
      intersectionCallback?.([{ isIntersecting: true }])
    })

    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/posts?page=2&limit=1'))
    expect(screen.getByText('First post')).toBeInTheDocument()

    resolveSecondPage?.({
      ok: true,
      json: async () => ({
        data: nextPagePosts,
        pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
      }),
    })

    await screen.findByText('Second post')
  })

  test('resets to fresh first-page data when resetKey changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ ...initialPosts[0], id: '4', title: 'Filtered first post', slug: 'filtered-first-post' }],
          pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
        }),
      }),
    )

    const { rerender } = render(<Harness resetKey="all" />)

    expect(screen.getByText('First post')).toBeInTheDocument()

    rerender(
      <Harness
        initialPagination={{
          page: 0,
          limit: 1,
          total: 0,
          totalPages: 0,
        }}
        initialPosts={[]}
        loadFirstPageOnMount
        resetKey="filtered"
      />,
    )

    expect(screen.getByText('loading')).toBeInTheDocument()
    expect(screen.queryByText('First post')).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Filtered first post')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith('/api/posts?page=1&limit=1')
  })

  test('retries the failed pending page through the public loadNextPage API', async () => {
    function RetryHarness() {
      const buildUrl = React.useCallback((page: number) => `/api/posts?page=${page}&limit=1`, [])
      const { error, loadNextPage, posts } = useInfinitePosts({
        initialPosts,
        initialPagination: {
          page: 1,
          limit: 1,
          total: 2,
          totalPages: 2,
        },
        buildUrl,
      })

      return (
        <div>
          <button type="button" onClick={() => void loadNextPage()}>
            load
          </button>
          {error ? <p>{error}</p> : null}
          {posts.map((post) => (
            <div key={post.id}>{post.title}</div>
          ))}
        </div>
      )
    }

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ success: false, error: 'Network failed' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: nextPagePosts,
            pagination: { page: 2, limit: 1, total: 2, totalPages: 2 },
          }),
        }),
    )

    render(<RetryHarness />)

    screen.getByRole('button', { name: 'load' }).click()

    await waitFor(() => {
      expect(screen.getByText('Network failed')).toBeInTheDocument()
    })

    screen.getByRole('button', { name: 'load' }).click()

    await waitFor(() => {
      expect(screen.getByText('Second post')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
