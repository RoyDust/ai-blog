import { act, render, screen } from '@testing-library/react'
import React from 'react'
import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

const findFirst = vi.fn()
const findMany = vi.fn()
const commentFindMany = vi.fn()
const getRecommendedPostsForPost = vi.fn()
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

vi.mock('@/lib/recommendations', () => ({
  getRecommendedPostsForPost,
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
getRecommendedPostsForPost.mockResolvedValue([])
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
  let publicPostPage: typeof import('@/app/(public)/posts/[slug]/page')
  let adminPreviewPage: typeof import('@/app/admin/posts/preview/[slug]/page')

  // 页面模块依赖链较重（react-markdown/rehype），全量测试高负载下逐测试导入会超过默认 5s 超时，
  // 且超时后悬挂的导入 promise 会在后续测试中 resolve 并触发 mock，因此统一在此一次性导入
  beforeAll(async () => {
    publicPostPage = await import('@/app/(public)/posts/[slug]/page')
    adminPreviewPage = await import('@/app/admin/posts/preview/[slug]/page')
  }, 60_000)

  beforeEach(() => {
    getRecommendedPostsForPost.mockResolvedValue([])
  })

  test('generates static params for published articles only', async () => {
    findMany.mockClear()
    findMany.mockResolvedValueOnce([{ slug: 'published-post' }, { slug: 'another-post' }])

    const { generateStaticParams } = publicPostPage

    await expect(generateStaticParams()).resolves.toEqual([
      { slug: 'published-post' },
      { slug: 'another-post' },
    ])
    expect(findMany).toHaveBeenCalledWith({
      where: { published: true, deletedAt: null },
      select: { slug: true },
      orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    })
  })

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

    const { default: PostPage } = adminPreviewPage
    const ui = await PostPage({
      params: Promise.resolve({ slug: 'draft-post' }),
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
    expect(getRecommendedPostsForPost).not.toHaveBeenCalled()
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

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    let container!: HTMLElement
    await act(async () => {
      const result = render(ui as React.ReactElement)
      container = result.container
    })

    expect(screen.getByRole('heading', { name: '目录' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '阅读进度' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '分享文章' })).toBeInTheDocument()
    expect(screen.getByText('回到顶部').closest('button')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByRole('heading', { level: 5, name: 'Deep Heading' })).toBeInTheDocument()
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument()
    expect(screen.getByText("Excerpt")).toBeInTheDocument()
    expect(screen.getByText("Author")).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '读后操作' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: '与我互动' })).not.toBeInTheDocument()
    expect(screen.getByTestId('article-hero-meta')).toHaveTextContent('2026-01-01')
    expect(screen.getByTestId('article-hero-meta')).toHaveTextContent('100 阅读')
    expect(screen.getByTestId('article-hero-meta')).toHaveTextContent('1 分钟')
    expect(screen.queryByRole('heading', { level: 2, name: '相关文章' })).not.toBeInTheDocument()

    const actions = screen.getByRole('region', { name: '文末操作' })
    expect(actions.className).toContain('article-actions')
    expect(screen.getByRole('link', { name: '写评论' })).toHaveAttribute('href', '#comments')
    // 「发表评论」是本页唯一的主按钮（在评论框里，CommentAuthGate 在此被 mock）
    expect(container.querySelectorAll('.ed-btn')).toHaveLength(0)

    expect(await screen.findByRole('heading', { level: 2, name: /评论\s*\(1\)/ })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /评论\s*\(1\)/ })).toHaveAttribute('id', 'comments')
    expect(screen.getByTestId('comment-auth-gate')).toHaveTextContent('Comment gate for p1')
    expect(await screen.findByText('Great article')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '回复 203.0.*.*' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '收藏文章' })).toBeInTheDocument()
    expect(getRecommendedPostsForPost).toHaveBeenCalledWith({ postId: 'p1', limit: 3 })
    expect(commentFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { postId: 'p1', parentId: null, deletedAt: null, status: 'APPROVED' },
      select: expect.objectContaining({
        replies: expect.objectContaining({
          where: { postId: 'p1', deletedAt: null, status: 'APPROVED' },
        }),
      }),
    }))
    expect(container.querySelector('.article-hero--plain')).toBeInTheDocument()
    expect(container.querySelector('.article-hero--plain + .ed-rule-strong')).toBeInTheDocument()
    expect(container.querySelector('.article-prose')).toBeInTheDocument()
    expect(container.querySelector('pre code')?.className).toContain('hljs')
    expect(container.querySelector('.article-code__lang')).toHaveTextContent('TypeScript')
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument()
    expect(container.querySelector('pre')?.parentElement?.className).toContain('article-code')
    expect(screen.getByTestId('toc-rail').className).toContain('xl:sticky')
    expect(screen.getByTestId('toc-rail').className).toContain('hidden')
    expect(screen.getByTestId('toc-rail')).toHaveAttribute('aria-label', '文章目录')
    expect(screen.getByRole('navigation', { name: '本文目录' })).toBeInTheDocument()
  })

  test('article page renders recommendations from the recommendation service', async () => {
    getRecommendedPostsForPost.mockResolvedValueOnce([
      {
        id: 'related-1',
        title: 'Related Post',
        slug: 'related-post',
        excerpt: 'Related excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        category: { name: 'Category', slug: 'category' },
        tags: [],
        publishedAt: new Date('2026-01-03T00:00:00Z'),
        viewCount: 12,
        _count: { likes: 1 },
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

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(screen.getByRole('heading', { level: 2, name: '相关文章' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Related Post/ })).toHaveAttribute('href', '/posts/related-post')
    expect(getRecommendedPostsForPost).toHaveBeenCalledWith({ postId: 'p1', limit: 3 })
  })

  test('article page can render recommendations even when the post has no tag overlap', async () => {
    getRecommendedPostsForPost.mockResolvedValueOnce([
      {
        id: 'fallback-1',
        title: 'Popular Fallback',
        slug: 'popular-fallback',
        excerpt: 'Fallback excerpt',
        coverImage: null,
        createdAt: new Date('2026-01-03T00:00:00Z'),
        publishedAt: new Date('2026-01-03T00:00:00Z'),
        viewCount: 90,
        category: null,
        tags: [],
        _count: { likes: 4 },
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
        series: null,
        tags: [],
        comments: [],
        _count: { comments: 0, likes: 2 },
      })

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(screen.getByRole('heading', { level: 2, name: '相关文章' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Popular Fallback/ })).toHaveAttribute('href', '/posts/popular-fallback')
    expect(getRecommendedPostsForPost).toHaveBeenCalledWith({ postId: 'p1', limit: 3 })
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

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    const tocRail = screen.getByTestId('toc-rail')
    const detailGrid = tocRail.parentElement
    expect(detailGrid?.className).toContain('article-layout')
    expect(detailGrid?.querySelector(':scope > .article-column')).toBeInTheDocument()
    expect(tocRail.previousElementSibling?.className).toContain('article-layout__rule')
    expect(tocRail.className).toContain('xl:sticky')
    expect(tocRail.className).not.toContain('xl:fixed')
    expect(tocRail.className).toContain('transition-[top]')
    expect(tocRail.className).toContain('will-change-[top]')
    expect(tocRail.getAttribute('style')).toContain('top: calc(var(--sidebar-sticky-top, 0px) + 1.5rem)')

    const tocNav = tocRail.firstElementChild
    expect(tocNav?.className).not.toContain('reader-panel')
    expect(tocNav?.className).toContain('max-h-[var(--article-toc-card-max-height)]')
    expect(tocNav).toHaveAttribute('data-state')
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

    const { default: PostPage } = publicPostPage
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

    const { default: PostPage } = publicPostPage
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

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    await screen.findAllByRole('link', { name: '来源链接' })

    const tocLinks = Array.from(screen.getByTestId('toc-rail').querySelectorAll('a')).map((link) => link.getAttribute('href'))
    expect(tocLinks).toEqual(['#来源链接', '#来源链接-2'])
    expect(screen.getAllByRole('heading', { level: 2, name: '来源链接' }).map((heading) => heading.id)).toEqual(['来源链接', '来源链接-2'])
  })

  test('article comments mark the post author with a seal, indent replies and show the empty sentence', async () => {
    const basePost = {
      id: 'p1',
      slug: 'test-post',
      title: 'Article Title',
      content: '# Intro\nBody text',
      excerpt: 'Excerpt',
      coverImage: 'https://example.com/cover.jpg',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
      publishedAt: new Date('2026-01-01T00:00:00Z'),
      viewCount: 1204,
      readingTimeMinutes: 9,
      author: { id: 'u1', name: 'Author', image: null },
      category: { name: 'Category', slug: 'category' },
      tags: [],
      comments: [],
      _count: { comments: 2, likes: 2 },
    }
    commentFindMany.mockResolvedValueOnce([
      {
        id: 'comment-1',
        content: 'Reader question',
        createdAt: new Date('2026-01-04T00:00:00Z'),
        authorLabel: '203.0.*.*',
        author: null,
        replies: [
          {
            id: 'reply-1',
            content: 'Author answer',
            createdAt: new Date('2026-01-05T00:00:00Z'),
            authorLabel: null,
            author: { id: 'u1', name: 'Author', image: null },
          },
        ],
      },
    ])
    findFirst.mockResolvedValueOnce(basePost)

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    let container!: HTMLElement
    await act(async () => {
      container = render(ui as React.ReactElement).container
    })

    expect(container.querySelector('.article-hero--cover')).toBeInTheDocument()
    // e2e/admin-covers.spec.ts 按 alt=标题 定位详情页封面
    expect(screen.getByRole('img', { name: 'Article Title' })).toBeInTheDocument()
    expect(screen.getByTestId('article-hero-meta')).toHaveTextContent('1,204 阅读')
    expect(await screen.findByText('Author answer')).toBeInTheDocument()
    const reply = screen.getByText('Author answer').closest('li')
    expect(reply?.parentElement?.className).toContain('article-comment__replies')
    expect(reply).toHaveTextContent('作者')
    expect(reply?.querySelector('.ed-seal')).toBeInTheDocument()
    expect(screen.getByText('Reader question').closest('article')?.querySelector('.ed-seal')).toBeNull()
    expect(screen.getAllByRole('button', { name: /^回复 / })).toHaveLength(2)
  })

  test('article comments show the editorial empty sentence when nobody has commented yet', async () => {
    commentFindMany.mockResolvedValueOnce([])
    findFirst.mockResolvedValueOnce({
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
      category: null,
      tags: [],
      comments: [],
      _count: { comments: 0, likes: 0 },
    })

    const { default: PostPage } = publicPostPage
    const ui = await PostPage({ params: Promise.resolve({ slug: 'test-post' }) })
    await act(async () => {
      render(ui as React.ReactElement)
    })

    expect(await screen.findByText('还没有评论，来说第一句。')).toBeInTheDocument()
    expect(screen.getByTestId('comment-auth-gate')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: /评论\s*\(0\)/ })).toBeInTheDocument()
  })
})
