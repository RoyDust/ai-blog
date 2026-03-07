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
        content: '# Intro\nBody text\n## Section\n##### Deep Heading\n```ts\nconst x = 1\n```',
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

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'unauthenticated',
    data: null,
  }),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('article experience', () => {
  test('article page includes progress and interaction rail', async () => {
    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    const { container } = render(ui as React.ReactElement)

    expect(screen.getByText('目录')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享文章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回顶部' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 5, name: 'Deep Heading' })).toBeInTheDocument()
    expect(screen.getByText('读到这里，来说说你的看法')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '参与讨论' })).toHaveAttribute('href', '#comments')
    expect(screen.getByRole('link', { name: '参与讨论' }).className).toContain('bg-[var(--primary)]')
    expect(container.querySelector('.prose')?.className).toContain('prose-pre:rounded-xl')
    expect(container.querySelector('pre code')?.className).toContain('hljs')
    expect(container.querySelector('#comments')).toBeInTheDocument()
    expect(screen.getByTestId('toc-rail').className).toContain('xl:fixed')
    expect(screen.getByTestId('toc-rail').className).toContain('hidden')
  })
})
