import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

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

function Harness() {
  const buildUrl = React.useCallback((page: number) => `/api/posts?page=${page}&limit=1`, [])

  const { posts, isLoading, observerTargetRef } = useInfinitePosts({
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
      <div>{isLoading ? 'loading' : 'idle'}</div>
      {posts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
      <div ref={observerTargetRef} />
    </div>
  )
}

describe('useInfinitePosts', () => {
  beforeEach(() => {
    intersectionCallback = undefined
    // @ts-expect-error test shim
    globalThis.IntersectionObserver = MockIntersectionObserver
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
})
