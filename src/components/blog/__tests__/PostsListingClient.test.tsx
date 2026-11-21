import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SWRConfig, mutate as clearSwrCache } from 'swr'

import { PostsListingClient } from '../PostsListingClient'

let currentSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentSearchParams,
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

function createPost(id: string) {
  return {
    id,
    title: `Post ${id}`,
    slug: `post-${id}`,
    excerpt: `Excerpt ${id}`,
    featured: id === '1',
    createdAt: '2026-03-01T00:00:00.000Z',
    coverImage: null,
    author: { id: `user-${id}`, name: 'Ada', image: null },
    category: { name: 'Tech', slug: 'tech' },
    tags: [{ name: 'Next', slug: 'next' }],
    _count: { comments: 1, likes: 2 },
  }
}

function SwrTestProvider({ children }: { children: React.ReactNode }) {
  return <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
}

function renderListing(ui: React.ReactElement) {
  return render(ui, { wrapper: SwrTestProvider })
}

describe('PostsListingClient', () => {
  beforeEach(async () => {
    currentSearchParams = new URLSearchParams()
    vi.restoreAllMocks()
    // SWR 全局缓存在用例间共享，逐用例清空保证独立性（需等待清空完成）
    await clearSwrCache(() => true, undefined, { revalidate: false })
  })

  test('shows skeleton cards before the first page resolves', async () => {
    const deferred = createDeferred<{
      ok: boolean
      json: () => Promise<{
        data: Array<{
          id: string
          title: string
          slug: string
          excerpt: string | null
          createdAt: string
          coverImage: string | null
          author: { id: string; name: string | null; image: string | null }
          category: { name: string; slug: string } | null
          tags: Array<{ name: string; slug: string }>
          _count: { comments: number; likes: number }
        }>
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>
    }>()

    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => deferred.promise))

    renderListing(
      <PostsListingClient
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    expect(screen.getAllByTestId('post-card-skeleton')).toHaveLength(6)
    expect(screen.getAllByTestId('post-card-skeleton')[0]).toHaveClass('reader-feed-card')
    expect(
      screen
        .getAllByTestId('post-card-skeleton')
        .every((skeleton) => !skeleton.parentElement?.classList.contains('onload-animation')),
    ).toBe(true)

    deferred.resolve({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'post-1',
            title: 'First post',
            slug: 'first-post',
            excerpt: 'A first post excerpt',
            createdAt: '2026-03-01T00:00:00.000Z',
            coverImage: null,
            author: { id: 'u1', name: 'Ada', image: null },
            category: { name: 'Tech', slug: 'tech' },
            tags: [{ name: 'Next', slug: 'next' }],
            _count: { comments: 1, likes: 2 },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    })

    await waitFor(() => {
      expect(screen.getAllByText('First post').length).toBeGreaterThan(0)
    })

    expect(fetch).toHaveBeenCalledWith('/api/posts?page=1&limit=10')
  })

  test('renders featured posts with the featured card and plain posts with the regular card', async () => {
    const posts = Array.from({ length: 6 }, (_, index) => ({
      ...createPost(String(index + 1)),
      featured: index < 2,
    }))

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: posts,
          pagination: { page: 1, limit: 10, total: 6, totalPages: 1 },
        }),
      }),
    )

    renderListing(
      <PostsListingClient
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Post 1').length).toBeGreaterThan(0)
    })

    expect(screen.getAllByText('精选文章')).toHaveLength(2)
    expect(screen.getByTestId('posts-listing')).toHaveClass('reader-section')
    expect(screen.getByTestId('posts-listing').firstElementChild).toHaveClass('grid', 'gap-2', 'md:gap-3')

    // 所有 6 篇文章均已渲染（Motion variants 不限制渲染数量）
    for (const id of ['1', '2', '3', '4', '5', '6']) {
      expect(screen.getByRole('heading', { name: `Post ${id}` })).toBeInTheDocument()
    }
  })

  test('shows skeleton cards again when search params change', async () => {
    const nextPage = {
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'post-1',
            title: 'First post',
            slug: 'first-post',
            excerpt: 'A first post excerpt',
            createdAt: '2026-03-01T00:00:00.000Z',
            coverImage: null,
            author: { id: 'u1', name: 'Ada', image: null },
            category: { name: 'Tech', slug: 'tech' },
            tags: [{ name: 'Next', slug: 'next' }],
            _count: { comments: 1, likes: 2 },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    }

    const deferred = createDeferred<typeof nextPage>()

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(nextPage)
        .mockImplementationOnce(() => deferred.promise),
    )

    const { rerender } = renderListing(
      <PostsListingClient
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('First post').length).toBeGreaterThan(0)
    })

    currentSearchParams = new URLSearchParams('q=react')

    rerender(
      <PostsListingClient
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    expect(screen.getAllByTestId('post-card-skeleton')).toHaveLength(6)
    expect(screen.queryAllByText('First post')).toHaveLength(0)

    deferred.resolve({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'post-2',
            title: 'React guide',
            slug: 'react-guide',
            excerpt: 'React guide excerpt',
            createdAt: '2026-03-02T00:00:00.000Z',
            coverImage: null,
            author: { id: 'u2', name: 'Grace', image: null },
            category: { name: 'Frontend', slug: 'frontend' },
            tags: [{ name: 'React', slug: 'react' }],
            _count: { comments: 3, likes: 5 },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      }),
    })

    await waitFor(() => {
      expect(screen.getAllByText('React guide').length).toBeGreaterThan(0)
    })

    expect(fetch).toHaveBeenLastCalledWith('/api/posts?page=1&limit=10')
  })

  test('keeps category, tag, q, and limit in pagination requests', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [createPost('2')],
          pagination: { page: 2, limit: 12, total: 12, totalPages: 2 },
        }),
      }),
    )

    renderListing(
      <PostsListingClient
        filters={{ category: 'frontend', tag: 'nextjs', search: 'react server' }}
        initialPagination={{ page: 0, limit: 12, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Post 2').length).toBeGreaterThan(0)
    })

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts?page=1&limit=12&category=frontend&tag=nextjs&q=react+server&search=react+server',
    )
  })
})
