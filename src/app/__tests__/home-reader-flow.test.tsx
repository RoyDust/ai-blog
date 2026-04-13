import { render, screen } from '@testing-library/react'
import React from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

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
  beforeEach(() => {
    postFindMany.mockReset()
    postCount.mockReset()
    categoryFindMany.mockReset()
    tagFindMany.mockReset()

    postFindMany.mockResolvedValue([
      {
        id: '1',
        title: 'Test Post',
        slug: 'test-post',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [{ name: 'Tag', slug: 'tag' }],
        _count: { comments: 1, likes: 2 },
      },
    ])
    postCount.mockResolvedValue(1)
    categoryFindMany.mockResolvedValue([])
    tagFindMany.mockResolvedValue([])
  })

  test("home shows curated hero, latest feed, and discovery modules", async () => {
    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole("heading", { name: "围绕主题，而不是时间线，浏览这座博客。" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "最新发布" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "继续探索" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "核心特性" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "开始阅读" })).toHaveAttribute("href", "/posts")
  })

  test('home surfaces load failures instead of silently pretending content is empty', async () => {
    categoryFindMany.mockRejectedValueOnce(new Error('category query failed'))

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('alert')).toHaveTextContent('首页部分内容加载失败，请稍后重试。')
  })
})
