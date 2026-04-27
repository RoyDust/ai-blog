import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const postsMocks = vi.hoisted(() => ({
  getPublishedPostsPage: vi.fn(),
}))

vi.mock('@/lib/posts', () => ({
  getPublishedPostsPage: postsMocks.getPublishedPostsPage,
}))

vi.mock('@/components/blog/PostsListingClient', () => ({
  PostsListingClient: ({
    initialPosts,
    initialPagination,
  }: {
    initialPosts: Array<{ title: string }>
    initialPagination: { page: number; total: number }
  }) => (
    <div>
      <p data-testid="initial-page">{initialPagination.page}</p>
      <p data-testid="initial-total">{initialPagination.total}</p>
      {initialPosts.map((post) => (
        <article key={post.title}>{post.title}</article>
      ))}
    </div>
  ),
}))

describe('/posts SEO shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('passes the first server-rendered posts page to the client listing', async () => {
    postsMocks.getPublishedPostsPage.mockResolvedValueOnce({
      posts: [{ id: 'post-1', title: 'Server rendered post' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { default: PostsPage } = await import('@/app/(public)/posts/page')
    const ui = await PostsPage()
    render(ui as React.ReactElement)

    expect(postsMocks.getPublishedPostsPage).toHaveBeenCalledWith({ page: 1, limit: expect.any(Number) })
    expect(screen.getByText('Server rendered post')).toBeInTheDocument()
    expect(screen.getByTestId('initial-page')).toHaveTextContent('1')
    expect(screen.getByTestId('initial-total')).toHaveTextContent('1')
  })
})
