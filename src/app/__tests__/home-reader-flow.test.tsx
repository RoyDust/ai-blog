import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { postFindMany, postCount, categoryFindMany, tagFindMany } = vi.hoisted(() => ({
  postFindMany: vi.fn(),
  postCount: vi.fn(),
  categoryFindMany: vi.fn(),
  tagFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany: postFindMany,
      count: postCount,
    },
    category: {
      findMany: categoryFindMany,
    },
    tag: {
      findMany: tagFindMany,
    },
  },
}))

describe('home reader flow', () => {
  const createPost = (index: number) => ({
    id: `${index}`,
    title: `Test Post ${index}`,
    slug: `test-post-${index}`,
    excerpt: `Excerpt ${index}`,
    coverImage: null,
    featured: false,
    createdAt: new Date(`2026-01-0${index}T00:00:00Z`),
    author: { id: `u${index}`, name: 'Author', image: null },
    category: { name: 'Category', slug: 'category' },
    tags: [{ name: 'Tag', slug: 'tag' }],
    _count: { comments: index, likes: index + 1 },
  })

  beforeEach(() => {
    postFindMany.mockReset()
    postCount.mockReset()
    categoryFindMany.mockReset()
    tagFindMany.mockReset()

    postFindMany.mockResolvedValue([createPost(1), createPost(2), createPost(3), createPost(4)])
    postCount.mockResolvedValue(4)
    categoryFindMany.mockResolvedValue([])
    tagFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    cleanup()
  })

  test('home shows intro row, curated featured grid, and latest feed hierarchy', async () => {
    postFindMany
      .mockResolvedValueOnce([createPost(4), createPost(5), createPost(6), createPost(1)])
      .mockResolvedValueOnce([
        { ...createPost(1), featured: true },
        { ...createPost(2), featured: true },
        { ...createPost(3), featured: true },
      ])

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByText('精选')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '精选文章' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '最新发布' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '继续探索' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '核心特性' })).not.toBeInTheDocument()
    const featuredSection = screen.getByRole('heading', { name: '精选文章' }).closest('section')
    const latestSection = screen.getByRole('heading', { name: '最新发布' }).closest('section')

    expect(featuredSection).not.toBeNull()
    expect(latestSection).not.toBeNull()

    const featured = within(featuredSection!)
    const latest = within(latestSection!)

    expect(featured.getByRole('heading', { name: 'Test Post 1' })).toBeInTheDocument()
    expect(featured.getByRole('heading', { name: 'Test Post 2' })).toBeInTheDocument()
    expect(featured.getByRole('heading', { name: 'Test Post 3' })).toBeInTheDocument()
    expect(featured.queryByRole('heading', { name: 'Test Post 4' })).not.toBeInTheDocument()

    expect(latest.getByRole('heading', { name: 'Test Post 4' })).toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 1' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 2' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 3' })).not.toBeInTheDocument()
  }, 15_000)

  test('home featured section degrades gracefully when only two curated posts exist', async () => {
    postFindMany
      .mockResolvedValueOnce([createPost(3), createPost(4)])
      .mockResolvedValueOnce([{ ...createPost(1), featured: true }, { ...createPost(2), featured: true }])
    postCount.mockResolvedValueOnce(2)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    const featuredSection = screen.getByRole('heading', { name: '精选文章' }).closest('section')

    expect(featuredSection).not.toBeNull()

    const featured = within(featuredSection!)

    expect(featured.getByRole('heading', { name: 'Test Post 1' })).toBeInTheDocument()
    expect(featured.getByRole('heading', { name: 'Test Post 2' })).toBeInTheDocument()
    expect(featured.queryByRole('heading', { name: 'Test Post 3' })).not.toBeInTheDocument()

    const secondaryGrid = screen.getByTestId('home-featured-secondary-grid')
    expect(secondaryGrid).toHaveClass('md:grid-cols-2')
    expect(screen.getAllByTestId('home-featured-secondary-item')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: '最新发布' })).toBeInTheDocument()
  })

  test('home surfaces load failures instead of silently pretending content is empty', async () => {
    categoryFindMany.mockRejectedValueOnce(new Error('category query failed'))

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('alert')).toHaveTextContent('首页部分内容加载失败，请稍后重试。')
  })

  test('home hides featured grid when there are no featured posts', async () => {
    postFindMany.mockResolvedValueOnce([createPost(1), createPost(2), createPost(3)])
    postFindMany.mockResolvedValueOnce([])
    postCount.mockResolvedValueOnce(3)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.queryByRole('heading', { name: '精选文章' })).not.toBeInTheDocument()
  })
})
