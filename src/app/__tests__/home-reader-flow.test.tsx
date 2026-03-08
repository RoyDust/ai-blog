import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany: vi.fn().mockResolvedValue([
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
      ]),
      count: vi.fn().mockResolvedValue(1),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    tag: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

describe('home reader flow', () => {
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
})
