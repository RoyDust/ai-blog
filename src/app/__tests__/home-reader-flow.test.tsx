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
    generatedByAiNews: false,
    excerpt: `Excerpt ${index}`,
    coverImage: null,
    featured: false,
    createdAt: new Date(Date.UTC(2026, 0, index)),
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
    tagFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'Next.js', slug: 'nextjs', color: null, _count: { posts: 14 } },
      { id: 'tag-2', name: '工程化', slug: 'engineering', color: null, _count: { posts: 12 } },
    ])
  })

  afterEach(() => {
    cleanup()
  })

  test('home shows Fuwari-style AI daily strip and latest feed', async () => {
    postFindMany
      .mockResolvedValueOnce(Array.from({ length: 11 }, (_, index) => createPost(index + 4)))
      .mockResolvedValueOnce([createPost(1), createPost(2), createPost(3)])

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    const { container } = render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: 'AI 日报' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '查看全部' })).toHaveAttribute('href', '/series/ai-daily')
    expect(postFindMany.mock.calls[1]?.[0]?.take).toBe(5)
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '目录预览' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '最近更新' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '热门标签' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '核心特性' })).not.toBeInTheDocument()
    const latestSection = screen.getByRole('heading', { name: '最新文章' }).closest('section')

    expect(latestSection).not.toBeNull()

    const latest = within(latestSection!)

    expect(latest.getByRole('heading', { name: 'Test Post 4' })).toBeInTheDocument()
    expect(latest.getByRole('heading', { name: 'Test Post 13' })).toBeInTheDocument()
    expect(latest.getAllByRole('article')).toHaveLength(10)
    expect(latest.queryByRole('heading', { name: 'Test Post 14' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 2' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 3' })).not.toBeInTheDocument()

    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')
    expect(jsonLd).toMatchObject({
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        'query-input': 'required name=search_term_string',
      },
    })
  }, 15_000)

  test('home keeps latest feed when only two posts exist', async () => {
    postFindMany
      .mockResolvedValueOnce([createPost(3), createPost(4)])
      .mockResolvedValueOnce([{ ...createPost(1), slug: 'ai-daily-2026-01-01', generatedByAiNews: true }])
    postCount.mockResolvedValueOnce(2)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('link', { name: /Test Post 1/ })).toHaveAttribute('href', '/posts/ai-daily-2026-01-01')
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()

    const latestSection = screen.getByRole('heading', { name: '最新文章' }).closest('section')
    expect(latestSection).not.toBeNull()
    const latest = within(latestSection!)
    expect(latest.getByRole('heading', { name: 'Test Post 3' })).toBeInTheDocument()
    expect(latest.getByRole('heading', { name: 'Test Post 4' })).toBeInTheDocument()
  })

  test('home surfaces load failures instead of silently pretending content is empty', async () => {
    postFindMany.mockResolvedValueOnce([createPost(1), createPost(2)])
    postFindMany.mockRejectedValueOnce(new Error('ai daily query failed'))

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('alert')).toHaveTextContent('首页部分内容加载失败，请稍后重试。')
  })

  test('home keeps a coherent latest fallback when AI daily has no posts', async () => {
    postFindMany.mockResolvedValueOnce([createPost(1), createPost(2), createPost(3)])
    postFindMany.mockResolvedValueOnce([])
    postCount.mockResolvedValueOnce(3)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.queryByRole('heading', { name: 'AI 日报' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Test Post 1' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
  })

  test('home latest feed keeps an empty reader panel when no latest posts remain', async () => {
    postFindMany.mockResolvedValueOnce([])
    postFindMany.mockResolvedValueOnce([])
    postCount.mockResolvedValueOnce(0)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
    expect(screen.getByText('最新文章区会保留当前位置，避免首页在空数据时突然塌陷。')).toBeInTheDocument()
  })
})
