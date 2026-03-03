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
  test('home shows featured section and latest feed', async () => {
    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '精选文章' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '最新发布' })).toBeInTheDocument()
  })
})
