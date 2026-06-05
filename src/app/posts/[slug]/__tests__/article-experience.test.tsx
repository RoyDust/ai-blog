import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

const findFirst = vi.fn()
const findMany = vi.fn()
const commentFindMany = vi.fn()
const getServerSession = vi.fn().mockResolvedValue(null)

vi.mock('@/components/CommentAuthGate', () => ({
  CommentAuthGate: ({ postId }: { postId: string }) => <div data-testid="comment-auth-gate">Comment gate for {postId}</div>,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findFirst,
      findMany,
    },
    comment: {
      findMany: commentFindMany,
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
  readingTimeMinutes: 1,
  author: { id: 'u1', name: 'Author', image: null },
  category: { name: 'Category', slug: 'category' },
  tags: [{ name: 'Tag', slug: 'tag' }],
  comments: [],
  _count: { comments: 0, likes: 2 },
})

findMany.mockResolvedValue([])
commentFindMany.mockResolvedValue([])

vi.mock('next-auth', () => ({
  getServerSession,
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
  test('admin preview renders an unpublished draft without public interactions', async () => {
    findFirst.mockClear()
    findMany.mockClear()
    commentFindMany.mockClear()
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    findFirst.mockResolvedValueOnce({
      id: 'draft-1',
      slug: 'draft-post',
      title: 'Draft Title',
      content: '# Draft Intro\nDraft body',
      excerpt: 'Draft excerpt',
      seoDescription: null,
      coverImage: null,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      publishedAt: null,
      published: false,
      viewCount: 0,
      readingTimeMinutes: 1,
      author: { id: 'u1', name: 'Author', image: null },
      category: { name: 'Category', slug: 'category' },
      series: null,
      tags: [{ name: 'Tag', slug: 'tag' }],
      _count: { comments: 0, likes: 0 },
    })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({
      params: Promise.resolve({ slug: 'draft-post' }),
      searchParams: Promise.resolve({ preview: 'admin' }),
    })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(findFirst.mock.calls[0]?.[0].where).toEqual({ slug: 'draft-post', deletedAt: null })
    expect(screen.getByRole('heading', { level: 1, name: 'Draft Intro' })).toBeInTheDocument()
    expect(screen.getByText('草稿预览仅后台管理员可见，公开阅读、点赞、收藏、评论和阅读统计已停用。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '点赞' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '收藏文章' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '评论 (0)' })).not.toBeInTheDocument()
    expect(findMany).not.toHaveBeenCalled()
    expect(commentFindMany).not.toHaveBeenCalled()
  })

  test('article page includes progress and anonymous interaction rail', async () => {
    commentFindMany.mockResolvedValueOnce([
      {
        id: 'comment-1',
        content: 'Great article',
        createdAt: new Date('2026-01-04T00:00:00Z'),
        authorLabel: '203.0.*.*',
        author: null,
        replies: [],
      },
    ])
    findFirst
      .mockResolvedValueOnce({
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
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [{ name: 'Tag', slug: 'tag' }],
        _count: { comments: 1, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    let container!: HTMLElement
    await act(async () => {
      const result = render(ui as React.ReactElement)
      container = result.container
    })

    expect(screen.getByRole('heading', { name: '目录' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享文章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '返回顶部' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 5, name: 'Deep Heading' })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument()
    expect(screen.getByText("Excerpt")).toBeInTheDocument()
    expect(screen.getByText("Author")).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '读后操作' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '与我互动' })).not.toBeInTheDocument()
    expect(screen.getByText('100 阅读')).toBeInTheDocument()
    expect(screen.getByText('预计阅读 1 分钟')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '相关文章' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '发表评论' })).toHaveAttribute('href', '#comments')
    expect(screen.getByRole('heading', { level: 2, name: '评论 (1)' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '评论 (1)' })).toHaveAttribute('id', 'comments')
    expect(screen.getByTestId('comment-auth-gate')).toHaveTextContent('Comment gate for p1')
    expect(await screen.findByText('Great article')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收藏文章' })).toBeInTheDocument()
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: 'p1' },
        tags: { some: { slug: { in: ['tag'] }, deletedAt: null } },
      }),
      take: 3,
    }))
    expect(commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { postId: 'p1', parentId: null, deletedAt: null },
    }))
    expect(container.querySelector('.reader-banner')).toBeInTheDocument()
    expect(container.querySelector('.reader-card')).toBeInTheDocument()
    expect(container.querySelector('.article-shell')).toBeInTheDocument()
    expect(container.querySelector('.reader-prose')?.className).toContain('prose-pre:rounded-2xl')
    expect(container.querySelector('pre code')?.className).toContain('hljs')
    expect(container.querySelector('.code-line.numbered-code-line')).toHaveAttribute('data-line-number', '1')
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument()
    expect(container.querySelector('pre')?.parentElement?.className).toContain('group')
    expect(screen.getByTestId('toc-rail').className).toContain('xl:sticky')
    expect(screen.getByTestId('toc-rail').className).toContain('hidden')
    expect(screen.getByTestId('toc-rail')).toHaveAttribute('aria-label', '文章目录')
    expect(screen.getByRole('navigation', { name: '本文目录' })).toBeInTheDocument()
  })

  test('article page renders related posts by shared tags', async () => {
    findMany.mockClear()
    findMany.mockResolvedValueOnce([
      {
        id: 'related-1',
        title: 'Related Post',
        slug: 'related-post',
        excerpt: 'Related excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        category: { name: 'Category', slug: 'category' },
      },
    ])
    findFirst
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'test-post',
        title: 'Article Title',
        content: '# Intro\nBody text',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        viewCount: 100,
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [{ name: 'Tag', slug: 'tag' }],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(screen.getByRole('heading', { level: 2, name: '相关文章' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Related Post/ })).toHaveAttribute('href', '/posts/related-post')
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: 'p1' },
        tags: { some: { slug: { in: ['tag'] }, deletedAt: null } },
      }),
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 3,
    }))
  })

  test('article toc rail aligns with the public content grid', async () => {
    findFirst
      .mockResolvedValueOnce({
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
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [{ name: 'Tag', slug: 'tag' }],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    const tocRail = screen.getByTestId('toc-rail')
    const detailGrid = tocRail.parentElement
    expect(detailGrid?.className).toContain('xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)]')
    expect(tocRail.className).toContain('xl:sticky')
    expect(tocRail.className).not.toContain('xl:fixed')
    expect(tocRail.className).toContain('transition-[top,box-shadow]')
    expect(tocRail.className).toContain('duration-700')
    expect(tocRail.className).toContain('ease-out')
    expect(tocRail.className).toContain('will-change-[top]')
    expect(tocRail.className).not.toContain('will-change-[top,transform]')
    expect(tocRail.className).not.toContain('xl:top-24')
    expect(tocRail.getAttribute('style')).toContain('top: calc(var(--sidebar-sticky-top, 0px) + 0.75rem)')

    const tocCard = tocRail.firstElementChild
    expect(tocCard?.className).toContain('reader-panel')
    expect(tocCard?.className).toContain('max-h-[var(--article-toc-card-max-height)]')
    expect(tocCard).toHaveAttribute('data-state')
  })

  test('article page renders series navigation when the post belongs to a series', async () => {
    findFirst
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'test-post',
        title: 'Article Title',
        content: '# Intro\nBody text',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        viewCount: 100,
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        series: {
          title: 'Next.js 系列',
          slug: 'nextjs-series',
          posts: [
            { title: '第一篇', slug: 'first-post', seriesOrder: 1 },
            { title: 'Article Title', slug: 'test-post', seriesOrder: 2 },
            { title: '第三篇', slug: 'third-post', seriesOrder: 3 },
          ],
        },
        tags: [],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(screen.getByRole('navigation', { name: 'Next.js 系列 系列导航' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Next\.js 系列/ })).toHaveAttribute('href', '/series/nextjs-series')
    expect(screen.getAllByRole('link', { name: /第一篇/ }).map((link) => link.getAttribute('href'))).toContain('/posts/first-post')
    expect(screen.getAllByRole('link', { name: /第三篇/ }).map((link) => link.getAttribute('href'))).toContain('/posts/third-post')
  })

  test('article page hides navigation for soft-deleted series', async () => {
    findFirst
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'test-post',
        title: 'Article Title',
        content: '# Intro\nBody text',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        viewCount: 100,
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        series: {
          title: 'Hidden Series',
          slug: 'hidden-series',
          deletedAt: new Date('2026-01-03T00:00:00Z'),
          posts: [{ title: 'Article Title', slug: 'test-post', seriesOrder: 1 }],
        },
        tags: [],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(screen.queryByRole('navigation', { name: 'Hidden Series 系列导航' })).not.toBeInTheDocument()
  })

  test('article heading anchors stay unique when headings repeat', async () => {
    findFirst
      .mockResolvedValueOnce({
        id: 'p1',
        slug: 'test-post',
        title: 'Article Title',
        content: '## 来源链接\n第一组来源\n## 来源链接\n第二组来源',
        excerpt: 'Excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
        publishedAt: new Date('2026-01-01T00:00:00Z'),
        viewCount: 100,
        readingTimeMinutes: 1,
        author: { id: 'u1', name: 'Author', image: null },
        category: { name: 'Category', slug: 'category' },
        tags: [],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = await import('@/app/(public)/posts/[slug]/page')
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    await screen.findAllByRole('link', { name: '来源链接' })

    const tocLinks = Array.from(screen.getByTestId('toc-rail').querySelectorAll('a')).map((link) => link.getAttribute('href'))
    expect(tocLinks).toEqual(['#来源链接', '#来源链接-2'])
    expect(screen.getAllByRole('heading', { level: 2, name: '来源链接' }).map((heading) => heading.id)).toEqual(['来源链接', '来源链接-2'])
  })
})
