import { cleanup, render, screen, within } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const { postFindMany, postCount, categoryFindMany, tagFindMany, seriesFindMany, topicGuideFindMany } = vi.hoisted(() => ({
  postFindMany: vi.fn(),
  postCount: vi.fn(),
  categoryFindMany: vi.fn(),
  tagFindMany: vi.fn(),
  seriesFindMany: vi.fn(),
  topicGuideFindMany: vi.fn(),
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
    series: {
      findMany: seriesFindMany,
    },
    topicGuide: {
      findMany: topicGuideFindMany,
    },
  },
}))

describe('home reader flow', () => {
  const createPost = (index: number) => ({
    id: `${index}`,
    title: `Test Post ${index}`,
    slug: `test-post-${index}`,
    generatedByAiNews: false,
    excerpt: `Excerpt ${index}`,
    coverImage: null,
    featured: false,
    createdAt: new Date(Date.UTC(2026, 0, index)),
    readingTimeMinutes: index + 4,
    viewCount: index * 10,
    author: { id: `u${index}`, name: 'Author', image: null },
    category: { name: 'Category', slug: 'category' },
    tags: [{ name: 'Tag', slug: 'tag' }],
    _count: { comments: index, likes: index + 1 },
  })

  beforeEach(() => {
    postFindMany.mockReset()
    postCount.mockReset()
    categoryFindMany.mockReset()
    tagFindMany.mockReset()
    seriesFindMany.mockReset()
    topicGuideFindMany.mockReset()
    // 客户端「发现」区通过 SWR 拉公开目录；这里返回空目录，避免真实网络请求
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })),
    )

    postFindMany.mockResolvedValue([createPost(1), createPost(2), createPost(3), createPost(4)])
    postCount.mockResolvedValue(4)
    categoryFindMany.mockResolvedValue([])
    seriesFindMany.mockResolvedValue([])
    topicGuideFindMany.mockResolvedValue([])
    tagFindMany.mockResolvedValue([
      { id: 'tag-1', name: 'Next.js', slug: 'nextjs', color: null, _count: { posts: 14 } },
      { id: 'tag-2', name: '工程化', slug: 'engineering', color: null, _count: { posts: 12 } },
    ])
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('home shows one editorial H1, a lead story, AI daily, and the short-dated latest feed', async () => {
    const nonAiPosts = Array.from({ length: 6 }, (_, index) => ({
      ...createPost(index + 4),
      ...(index === 0 ? { coverImage: '/images/test-post-4.jpg' } : {}),
    }))
    const mixedPosts = [
      ...nonAiPosts.slice(0, 4),
      ...Array.from({ length: 7 }, (_, index) => ({
        ...createPost(index + 8),
        generatedByAiNews: true,
      })),
    ]

    postFindMany
      .mockImplementationOnce(async (args) =>
        args?.orderBy?.[0]?.generatedByAiNews === 'asc' ? mixedPosts.slice(0, args.take) : mixedPosts,
      )
      .mockResolvedValueOnce([createPost(1), createPost(2), createPost(3)])
    seriesFindMany.mockResolvedValueOnce([
      { id: 's1', title: 'AI 日报', slug: 'ai-daily', _count: { posts: 30 }, posts: [{ title: '最新一期' }] },
      { id: 's2', title: '工程实践', slug: 'engineering', _count: { posts: 6 }, posts: [] },
    ])
    topicGuideFindMany.mockResolvedValueOnce([
      { id: 'g1', title: 'RAG 专题', slug: 'rag', description: '检索增强生成', posts: [{ id: 'gp1' }] },
    ])

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    const { container } = render(ui as React.ReactElement)

    const h1 = screen.getAllByRole('heading', { level: 1 })
    expect(h1).toHaveLength(1)
    expect(h1[0]).toHaveTextContent('My Blog')
    expect(h1[0]).toHaveClass('ed-serif')

    // 报头 + 精选：2px 报头线、衬线 h2 标题、「阅读全文 →」文字链接、装饰性封面
    const editorialHero = screen.getByTestId('home-editorial-hero')
    expect(editorialHero).toHaveClass('home-editorial-hero')
    expect(editorialHero.querySelector('hr.ed-rule-strong')).toBeInTheDocument()
    expect(within(editorialHero).getByRole('heading', { level: 2, name: 'Test Post 4' })).toBeInTheDocument()
    const readLead = within(editorialHero).getByRole('link', { name: '阅读全文：Test Post 4' })
    expect(readLead).toHaveAttribute('href', '/posts/test-post-4')
    expect(readLead).toHaveClass('ed-link')
    const cover = editorialHero.querySelector('a.ed-media')
    expect(cover).toHaveAttribute('href', '/posts/test-post-4')
    expect(cover).toHaveAttribute('aria-hidden', 'true')
    expect(cover?.querySelector('img')).toHaveAttribute('alt', '')
    // 不是精选文章时不盖「精选」印章
    expect(within(editorialHero).queryByText('精选')).not.toBeInTheDocument()

    expect(screen.getByRole('heading', { name: 'AI 日报' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '全部日报' })).toHaveAttribute('href', '/series/ai-daily')
    expect(screen.getByText('今日日报生成中')).toBeInTheDocument()
    expect(postFindMany.mock.calls[0]?.[0]).toMatchObject({
      orderBy: [
        { generatedByAiNews: 'asc' },
        { featured: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      // 多取一篇：第一篇进精选，其余 5 篇进「最新文章」
      take: 6,
    })
    expect(postFindMany.mock.calls[1]?.[0]).toMatchObject({ where: { generatedByAiNews: true }, take: 5 })
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '目录预览' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '最近更新' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '热门标签' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '核心特性' })).not.toBeInTheDocument()
    const latestSection = screen.getByRole('heading', { name: '最新文章' }).closest('section')

    expect(latestSection).not.toBeNull()

    const latest = within(latestSection!)

    expect(latest.queryByRole('heading', { name: 'Test Post 4' })).not.toBeInTheDocument()
    expect(latest.getByRole('heading', { name: 'Test Post 5' })).toBeInTheDocument()
    expect(latest.getByRole('heading', { name: 'Test Post 9' })).toBeInTheDocument()
    const rows = latest.getAllByTestId('post-list-row')
    expect(rows).toHaveLength(5)
    expect(rows.every((row) => row.classList.contains('ed-row'))).toBe(true)
    // 首页最新文章用单行「MM-DD」日期
    expect(rows[0].querySelector('.ed-row__date--desktop time')).toHaveTextContent(/^\d{2}-\d{2}$/)
    expect(latest.queryByRole('heading', { name: 'Test Post 10' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 2' })).not.toBeInTheDocument()
    expect(latest.queryByRole('heading', { name: 'Test Post 3' })).not.toBeInTheDocument()

    // 系列与专题：每日系列写「每天一篇」
    expect(screen.getByRole('heading', { level: 2, name: '系列与专题' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /AI 日报.*每天一篇/ })).toHaveAttribute('href', '/series/ai-daily')
    expect(screen.getByRole('link', { name: /工程实践.*6 篇/ })).toHaveAttribute('href', '/series/engineering')
    expect(screen.getByRole('link', { name: /RAG 专题/ })).toHaveAttribute('href', '/guides/rag')

    // Newsletter 横带上的「订阅」是整页唯一的实底主按钮
    const newsletter = screen.getByRole('region', { name: '订阅 Newsletter' })
    expect(within(newsletter).getByRole('button', { name: '订阅' })).toHaveClass('ed-btn')
    expect(container.querySelectorAll('.ed-btn')).toHaveLength(1)

    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')
    expect(jsonLd).toMatchObject({
      '@type': 'WebSite',
      potentialAction: {
        '@type': 'SearchAction',
        'query-input': 'required name=search_term_string',
      },
    })
  }, 15_000)

  test('home keeps latest feed when only two posts exist and stamps a featured lead story', async () => {
    postFindMany
      .mockResolvedValueOnce([
        createPost(4),
        { ...createPost(3), featured: true, coverImage: '/images/test-post-3.jpg' },
      ])
      .mockResolvedValueOnce([{ ...createPost(1), slug: 'ai-daily-2026-01-01', generatedByAiNews: true }])
    postCount.mockResolvedValueOnce(2)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('link', { name: /Test Post 1/ })).toHaveAttribute('href', '/posts/ai-daily-2026-01-01')
    // 精选文章优先进报头，并盖「精选」印章
    const hero = screen.getByTestId('home-editorial-hero')
    expect(within(hero).getByRole('link', { name: '阅读全文：Test Post 3' })).toHaveAttribute('href', '/posts/test-post-3')
    expect(within(hero).getByText('精选')).toHaveClass('ed-seal')
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()

    const latestSection = screen.getByRole('heading', { name: '最新文章' }).closest('section')
    expect(latestSection).not.toBeNull()
    const latest = within(latestSection!)
    expect(latest.queryByRole('heading', { name: 'Test Post 3' })).not.toBeInTheDocument()
    expect(latest.getByRole('heading', { name: 'Test Post 4' })).toBeInTheDocument()
    // 首页最新不写「精选」标记
    expect(latest.queryByText('精选')).not.toBeInTheDocument()
  })

  test('home surfaces load failures instead of silently pretending content is empty', async () => {
    postFindMany.mockResolvedValueOnce([createPost(1), createPost(2)])
    postFindMany.mockRejectedValueOnce(new Error('ai daily query failed'))

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getByRole('alert')).toHaveTextContent('首页部分内容加载失败，请稍后重试。')
  })

  test('home keeps a coherent latest fallback when AI daily has no posts', async () => {
    postFindMany.mockResolvedValueOnce([createPost(1), createPost(2), createPost(3)])
    postFindMany.mockResolvedValueOnce([])
    postCount.mockResolvedValueOnce(3)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.queryByRole('heading', { name: 'AI 日报' })).not.toBeInTheDocument()
    expect(within(screen.getByTestId('home-editorial-hero')).getByText('Test Post 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
  })

  test('home latest feed shows a text-only empty state when no latest posts remain', async () => {
    postFindMany.mockResolvedValueOnce([])
    postFindMany.mockResolvedValueOnce([])
    postCount.mockResolvedValueOnce(0)

    const { default: Home } = await import('../(public)/page')
    const ui = await Home()
    render(ui as React.ReactElement)

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /^阅读全文/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('home-editorial-hero').querySelector('article')).toBeNull()
    expect(screen.getByRole('heading', { name: '最新文章' })).toBeInTheDocument()
    // 空态：一句衬线文案 + 文字链接，不画容器
    expect(screen.getByText('还没有发布文章，第一篇正在路上。')).toHaveClass('ed-empty__title')
    expect(screen.getByRole('link', { name: '浏览系列' })).toHaveAttribute('href', '/series')
    expect(screen.queryByTestId('post-list-row')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '系列与专题' })).not.toBeInTheDocument()
  })
})
