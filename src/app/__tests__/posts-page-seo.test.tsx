import React from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const postsMocks = vi.hoisted(() => ({
  getPublishedPostsPage: vi.fn(),
}))

const taxonomyMocks = vi.hoisted(() => ({
  getCategoryDirectory: vi.fn(),
  getTagDirectory: vi.fn(),
}))

vi.mock('@/lib/posts', () => ({
  getPublishedPostsPage: postsMocks.getPublishedPostsPage,
}))

vi.mock('@/lib/taxonomy', () => ({
  getCategoryDirectory: taxonomyMocks.getCategoryDirectory,
  getTagDirectory: taxonomyMocks.getTagDirectory,
}))

vi.mock('@/components/blog/PostsListingClient', () => ({
  PostsListingClient: ({
    initialPosts,
    initialPagination,
    filters,
  }: {
    initialPosts: Array<{ title: string }>
    initialPagination: { page: number; total: number }
    filters?: { category?: string; tag?: string; search?: string }
  }) => (
    <div>
      <p data-testid="initial-page">{initialPagination.page}</p>
      <p data-testid="initial-total">{initialPagination.total}</p>
      <p data-testid="initial-filters">{JSON.stringify(filters ?? {})}</p>
      {initialPosts.map((post) => (
        <article key={post.title}>{post.title}</article>
      ))}
    </div>
  ),
}))

describe('/posts SEO shell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taxonomyMocks.getCategoryDirectory.mockResolvedValue([{ name: 'Frontend', slug: 'frontend' }])
    taxonomyMocks.getTagDirectory.mockResolvedValue([{ name: 'Next.js', slug: 'nextjs' }])
  })

  test('passes the first server-rendered posts page to the client listing', async () => {
    postsMocks.getPublishedPostsPage.mockResolvedValueOnce({
      posts: [{ id: 'post-1', title: 'Server rendered post' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { default: PostsPage } = await import('@/app/(public)/posts/page')
    const ui = await PostsPage()
    render(ui as React.ReactElement)

    expect(postsMocks.getPublishedPostsPage).toHaveBeenCalledWith({
      page: 1,
      limit: expect.any(Number),
      category: undefined,
      tag: undefined,
      search: undefined,
    })
    expect(screen.getByText('Server rendered post')).toBeInTheDocument()
    expect(screen.getByTestId('initial-page')).toHaveTextContent('1')
    expect(screen.getByTestId('initial-total')).toHaveTextContent('1')
  })

  test('applies category, tag, q, and limit search params to the first rendered page', async () => {
    postsMocks.getPublishedPostsPage.mockResolvedValueOnce({
      posts: [{ id: 'post-1', title: 'Filtered post' }],
      pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
    })

    const { default: PostsPage } = await import('@/app/(public)/posts/page')
    const ui = await PostsPage({
      searchParams: Promise.resolve({
        category: 'frontend',
        tag: 'nextjs',
        q: 'react',
        limit: '12',
      }),
    })
    render(ui as React.ReactElement)

    expect(postsMocks.getPublishedPostsPage).toHaveBeenCalledWith({
      page: 1,
      limit: 12,
      category: 'frontend',
      tag: 'nextjs',
      search: 'react',
    })
    expect(screen.getByText('Filtered post')).toBeInTheDocument()
    expect(screen.getByTestId('initial-filters')).toHaveTextContent(
      JSON.stringify({ category: 'frontend', tag: 'nextjs', search: 'react' }),
    )
    expect(screen.getByRole('link', { name: '关键词: react' })).toHaveAttribute(
      'href',
      '/posts?category=frontend&tag=nextjs',
    )
  })

  test.each([
    ['category directory', () => taxonomyMocks.getCategoryDirectory.mockRejectedValueOnce(new Error('category failed'))],
    ['tag directory', () => taxonomyMocks.getTagDirectory.mockRejectedValueOnce(new Error('tag failed'))],
  ])('still renders posts when %s loading fails', async (_label, rejectDirectory) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    rejectDirectory()
    postsMocks.getPublishedPostsPage.mockResolvedValueOnce({
      posts: [{ id: 'post-1', title: 'Taxonomy failure post' }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    })

    const { default: PostsPage } = await import('@/app/(public)/posts/page')
    const ui = await PostsPage()
    render(ui as React.ReactElement)

    expect(screen.getByText('Taxonomy failure post')).toBeInTheDocument()
    expect(screen.getByTestId('initial-page')).toHaveTextContent('1')
    expect(screen.getByTestId('initial-total')).toHaveTextContent('1')
    expect(postsMocks.getPublishedPostsPage).toHaveBeenCalledWith({
      page: 1,
      limit: expect.any(Number),
      category: undefined,
      tag: undefined,
      search: undefined,
    })
    consoleError.mockRestore()
  })
})
