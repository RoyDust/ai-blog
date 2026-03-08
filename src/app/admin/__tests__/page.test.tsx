import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      count: vi.fn().mockResolvedValue(3),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'post-1',
          title: 'Recent Post',
          slug: 'recent-post',
          published: true,
          createdAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]),
    },
    user: {
      count: vi.fn().mockResolvedValue(2),
    },
    comment: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'comment-1',
          content: '匿名评论内容',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          author: null,
          authorLabel: '匿名访客',
          post: { title: 'Recent Post', slug: 'recent-post' },
        },
      ]),
    },
    category: {
      count: vi.fn().mockResolvedValue(4),
    },
  },
}))

describe('admin overview', () => {
  test('renders anonymous recent comments without crashing', async () => {
    const { default: AdminPage } = await import('../page')
    const ui = await AdminPage()

    render(ui as React.ReactElement)

    expect(screen.getByText('匿名访客')).toBeInTheDocument()
    expect(screen.getByText('匿名评论内容')).toBeInTheDocument()
  })
})
