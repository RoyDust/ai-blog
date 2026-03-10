import React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { POSTS_SCROLL_LOAD_THRESHOLD } from '@/lib/pagination'
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

function Harness() {
  const { posts, isLoading } = useInfinitePosts({
    initialPosts,
    initialPagination: {
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    },
    buildUrl: (page) => `/api/posts?page=${page}&limit=1`,
  })

  return (
    <div>
      <div>{isLoading ? 'loading' : 'idle'}</div>
      {posts.map((post) => (
        <div key={post.id}>{post.title}</div>
      ))}
    </div>
  )
}

describe('useInfinitePosts', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', {
      value: 600,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'scrollY', {
      value: 0,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 1000,
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test(`loads the next page after scrolling past ${POSTS_SCROLL_LOAD_THRESHOLD * 100} percent`, async () => {
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
      Object.defineProperty(window, 'scrollY', {
        value: 220,
        writable: true,
        configurable: true,
      })
      window.dispatchEvent(new Event('scroll'))
    })

    await waitFor(() => {
      expect(screen.getByText('Second post')).toBeInTheDocument()
    })

    expect(fetch).toHaveBeenCalledWith('/api/posts?page=2&limit=1')
  })

  test('does not load the next page immediately on mount', async () => {
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

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 700,
      writable: true,
      configurable: true,
    })

    render(<Harness />)

    await waitFor(() => {
      expect(screen.getByText('First post')).toBeInTheDocument()
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText('Second post')).not.toBeInTheDocument()
  })
})
