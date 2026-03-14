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

  test('home shows latest feed and category discovery', async () => {
    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /查看全部/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '浏览分类' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '核心特性' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /文章/i })).toBeInTheDocument()
  })

  test('home surfaces load failures instead of silently pretending content is empty', async () => {
    categoryFindMany.mockRejectedValueOnce(new Error('category query failed'))

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('alert')).toHaveTextContent('首页部分内容加载失败，请稍后重试。')
  })
})
