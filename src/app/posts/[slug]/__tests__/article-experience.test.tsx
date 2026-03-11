import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

const findFirst = vi.fn()
const findMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findFirst,
      findMany,
    },
  },
}))

findFirst.mockResolvedValue({
  id: 'p1',
  slug: 'test-post',
  title: 'Article Title',
  content: '# Intro\nBody text\n## Section\n##### Deep Heading\n```ts\nconst x = 1\n```',
  excerpt: 'Excerpt',
  coverImage: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  viewCount: 100,
  author: { id: 'u1', name: 'Author', image: null },
  category: { name: 'Category', slug: 'category' },
  tags: [{ name: 'Tag', slug: 'tag' }],
  comments: [],
  _count: { comments: 0, likes: 2 },
})

findMany.mockResolvedValue([])

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'unauthenticated',
    data: null,
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('article experience', () => {
  test('article page includes progress and anonymous interaction rail', async () => {
    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    const { container } = render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '目录' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享文章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回顶部' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 5, name: 'Deep Heading' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '与我互动' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收藏文章' })).toBeInTheDocument()
    expect(container.querySelector('.prose')?.className).toContain('prose-pre:rounded-xl')
    expect(container.querySelector('pre code')?.className).toContain('hljs')
    expect(screen.getByTestId('toc-rail').className).toContain('xl:fixed')
    expect(screen.getByTestId('toc-rail').className).toContain('hidden')
  })

  test('article toc rail offsets with navbar sticky height', async () => {
    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    render(ui as React.ReactElement)

    const tocRail = screen.getByTestId('toc-rail')
    expect(tocRail.className).toContain('xl:fixed')
    expect(tocRail.className).toContain('transition-[top,max-height,transform,box-shadow]')
    expect(tocRail.className).toContain('duration-300')
    expect(tocRail.className).toContain('ease-out')
    expect(tocRail.className).toContain('will-change-[top,transform]')
    expect(tocRail.className).not.toContain('xl:top-24')
    expect(tocRail.getAttribute('style')).toContain('top: calc(var(--sidebar-sticky-top, 0px) + 1rem)')

    const tocCard = tocRail.firstElementChild
    expect(tocCard?.getAttribute('style')).toContain('max-height: calc(100vh - var(--sidebar-sticky-top, 0px) - 2rem)')
  })
})
