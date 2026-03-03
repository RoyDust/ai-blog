import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'p1',
        slug: 'test-post',
        title: 'Article Title',
        content: '# Intro\nBody text\n## Section',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        viewCount: 100,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [{ name: 'Tag', slug: 'tag' }],
        comments: [],
        _count: { comments: 0, likes: 2 },
      }),
    },
  },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('article experience', () => {
  test('article page includes progress and interaction rail', async () => {
    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    render(ui as React.ReactElement)

    expect(screen.getByText('目录')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
