import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

function expectInitialSkeleton() {
  const listing = screen.getByTestId('posts-listing')
  expect(listing).toHaveAttribute('aria-busy', 'true')
  expect(screen.getByRole('status')).toHaveTextContent('正在加载文章')
  // 与真实行同尺寸的 4 行细条骨架，首屏不画置顶精选
  const skeletonRows = listing.querySelectorAll('.ed-row[aria-hidden="true"]')
  expect(skeletonRows).toHaveLength(4)
  expect(listing.querySelectorAll('.ed-skel').length).toBeGreaterThan(0)
  expect(screen.queryByTestId('post-featured')).not.toBeInTheDocument()
  expect(screen.queryAllByTestId('post-list-row')).toHaveLength(0)
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
    // 只撤销 fetch 桩；不要 restoreAllMocks，否则 setup 中 matchMedia 的 mock 实现会被清空（useReducedMotion 依赖它）
    vi.unstubAllGlobals()
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

    expectInitialSkeleton()

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

    // 无筛选时首篇精选置顶，用置顶精选样式；其余精选只在 meta 开头写「精选」
    const pinned = screen.getByTestId('post-featured')
    expect(within(pinned).getByRole('heading', { level: 2, name: 'Post 1' })).toBeInTheDocument()
    expect(within(pinned).getByText('精选')).toHaveClass('ed-seal')

    const rows = screen.getAllByTestId('post-list-row')
    expect(rows).toHaveLength(5)
    expect(rows.every((row) => row.classList.contains('ed-row'))).toBe(true)
    expect(within(rows[0]).getByRole('heading', { name: 'Post 2' })).toBeInTheDocument()
    expect(within(rows[0]).getByText('精选')).toBeInTheDocument()
    expect(within(rows[1]).queryByText('精选')).not.toBeInTheDocument()
    expect(screen.queryByText('精选文章')).not.toBeInTheDocument()
    expect(screen.getByTestId('posts-listing').className).not.toContain('reader-section')

    // 所有 6 篇文章均已渲染（Motion variants 不限制渲染数量）
    for (const id of ['1', '2', '3', '4', '5', '6']) {
      expect(screen.getByRole('heading', { name: `Post ${id}` })).toBeInTheDocument()
    }

    // 单页列表不显示「已显示全部」
    expect(screen.queryByText(/已显示全部/)).not.toBeInTheDocument()
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

    expectInitialSkeleton()
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
  test('does not pin a featured post when filters are active', async () => {
    const posts = [createPost('1'), createPost('2')]

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: posts, pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } }),
      }),
    )

    renderListing(
      <PostsListingClient
        filters={{ category: 'tech' }}
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    await waitFor(() => {
      expect(screen.getAllByTestId('post-list-row')).toHaveLength(2)
    })

    expect(screen.queryByTestId('post-featured')).not.toBeInTheDocument()
    expect(within(screen.getAllByTestId('post-list-row')[0]).getByText('精选')).toBeInTheDocument()
  })

  test('renders server-provided posts without fetching and does not pin a non-featured first post', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderListing(
      <PostsListingClient
        initialPagination={{ page: 1, limit: 10, total: 2, totalPages: 1 }}
        initialPosts={[createPost('2'), createPost('3')]}
      />,
    )

    expect(screen.queryByTestId('post-featured')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('post-list-row')).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('shows an empty state with a clear-filters link when a filter has no posts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } }),
      }),
    )

    renderListing(
      <PostsListingClient
        filters={{ tag: 'missing' }}
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
      />,
    )

    expect(await screen.findByText('这个筛选下还没有文章')).toHaveClass('ed-empty__title')
    expect(screen.getByRole('link', { name: '清空筛选' })).toHaveAttribute('href', '/posts')
  })

  test('shows a danger error with a retry button that reloads the failed page', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Internal server error' }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [createPost('2')],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}>
        <PostsListingClient initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }} initialPosts={[]} />
      </SWRConfig>,
    )

    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('文章加载失败，请稍后重试')).toHaveClass('ed-empty__title', 'ed-empty__title--danger')

    const retry = within(alert).getByRole('button', { name: '重试' })
    expect(retry).toHaveClass('ed-btn-outline')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fireEvent.click(retry)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Post 2' })).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/posts?page=1&limit=10')
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
  })

  test('shows the end-of-list summary with a back-to-top link once every page is loaded', () => {
    vi.stubGlobal('fetch', vi.fn())

    renderListing(
      <PostsListingClient
        initialPagination={{ page: 2, limit: 10, total: 12, totalPages: 2 }}
        initialPosts={[createPost('11'), createPost('12')]}
      />,
    )

    const summary = screen.getByText(/已显示全部/).closest('p')
    expect(summary).toHaveTextContent('已显示全部 12 篇·回到顶部')
    expect(within(summary!).getByText('12')).toHaveClass('ed-mono')

    const backToTop = within(summary!).getByRole('button', { name: '回到顶部' })
    expect(backToTop).toHaveClass('ed-link')
    fireEvent.click(backToTop)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })
})
