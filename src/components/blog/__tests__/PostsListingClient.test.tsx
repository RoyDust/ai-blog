import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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

describe('PostsListingClient', () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams()
    vi.restoreAllMocks()
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

    render(
      <PostsListingClient
        categories={[]}
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
        tags={[]}
      />,
    )

    expect(screen.getAllByTestId('post-card-skeleton')).toHaveLength(6)

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
      expect(screen.getByText('First post')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith('/api/posts?page=1&limit=10')
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

    const { rerender } = render(
      <PostsListingClient
        categories={[]}
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
        tags={[]}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('First post')).toBeInTheDocument()
    })

    currentSearchParams = new URLSearchParams('q=react')

    rerender(
      <PostsListingClient
        categories={[]}
        initialPagination={{ page: 0, limit: 10, total: 0, totalPages: 0 }}
        initialPosts={[]}
        tags={[]}
      />,
    )

    expect(screen.getAllByTestId('post-card-skeleton')).toHaveLength(6)
    expect(screen.queryByText('First post')).not.toBeInTheDocument()

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
      expect(screen.getByText('React guide')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenLastCalledWith('/api/posts?page=1&limit=10&search=react')
  })
})
