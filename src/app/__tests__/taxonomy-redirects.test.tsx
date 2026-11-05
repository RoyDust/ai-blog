import { render, screen } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/taxonomy', () => ({
  TAXONOMY_PAGE_SIZE: 12,
  getCategoryDirectory: vi.fn().mockResolvedValue([
    { id: 'c1', name: '前端', slug: 'frontend', description: '前端工程与交互体验', _count: { posts: 4 } },
  ]),
  getTagDirectory: vi.fn().mockResolvedValue([
    { id: 't1', name: 'Next.js', slug: 'nextjs', color: '#000000', _count: { posts: 3 } },
  ]),
  getCategoryDetail: vi.fn().mockImplementation(async (slug: string) =>
    slug === 'frontend'
      ? {
          id: 'c1',
          name: '前端',
          slug: 'frontend',
          description: '前端工程与交互体验',
          _count: { posts: 1 },
          pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
          posts: [
            {
              id: 'p1',
              title: 'Build Better UI',
              slug: 'build-better-ui',
              excerpt: 'ui',
              coverImage: null,
              createdAt: new Date('2026-03-01T08:00:00Z'),
              viewCount: 12,
              author: { id: 'u1', name: 'Roy', image: null },
              category: { id: 'c1', name: '前端', slug: 'frontend' },
              tags: [{ id: 't1', name: 'Next.js', slug: 'nextjs', color: null }],
              _count: { comments: 1, likes: 2 },
            },
          ],
        }
      : null,
  ),
  getTagDetail: vi.fn().mockImplementation(async (slug: string) =>
    slug === 'nextjs'
      ? {
          id: 't1',
          name: 'Next.js',
          slug: 'nextjs',
          color: '#000000',
          _count: { posts: 1 },
          pagination: { page: 1, limit: 12, total: 1, totalPages: 1 },
          posts: [
            {
              id: 'p2',
              title: 'Next Patterns',
              slug: 'next-patterns',
              excerpt: 'patterns',
              coverImage: null,
              createdAt: new Date('2026-03-02T08:00:00Z'),
              viewCount: 8,
              author: { id: 'u1', name: 'Roy', image: null },
              category: { id: 'c1', name: '前端', slug: 'frontend' },
              tags: [{ id: 't1', name: 'Next.js', slug: 'nextjs', color: null }],
              _count: { comments: 0, likes: 3 },
            },
          ],
        }
      : null,
  ),
}))

vi.mock('@/lib/blog-settings', () => ({
  getBlogSettings: vi.fn(async () => ({
    siteName: 'Configured Blog',
    siteDescription: 'Configured description',
    siteUrl: 'https://blog.example',
    locale: 'zh-CN',
  })),
}))

describe('taxonomy routes', () => {
  test('/categories renders category directory', async () => {
    const { default: CategoriesPage } = await import('@/app/(public)/categories/page')
    const ui = await CategoriesPage()

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { level: 1, name: '全部分类' })).toBeInTheDocument()
    expect(document.querySelector('.ed-masthead .ed-rule-strong')).toBeInTheDocument()
    expect(document.querySelector('.reader-banner')).toBeNull()
    expect(document.querySelector('.reader-card')).toBeNull()
    expect(screen.getByText('1 个分类 · 4 篇文章')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前端' })).toHaveAttribute('href', '/categories/frontend')
    expect(screen.getByText('4 篇')).toBeInTheDocument()
    expect(screen.getByText('前端工程与交互体验')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '全部文章' })).toHaveAttribute('href', '/posts')
    // 目录页不放「在列表页中筛选」
    expect(screen.queryByRole('link', { name: '在列表页中筛选' })).not.toBeInTheDocument()
  })

  test('/tags renders tag directory', async () => {
    const { default: TagsPage } = await import('@/app/(public)/tags/page')
    const ui = await TagsPage()

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { level: 1, name: '全部标签' })).toBeInTheDocument()
    expect(document.querySelector('.reader-banner')).toBeNull()
    expect(document.querySelector('.reader-card')).toBeNull()
    // 不足 12 个标签时只排「全部」一组，避免重复
    expect(screen.getByRole('heading', { name: '全部 1' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /^常用/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#Next.js 3 篇' })).toHaveAttribute('href', '/tags/nextjs')
  })

  test('/categories/[slug] renders category article list', async () => {
    const { default: CategoryPage } = await import('@/app/(public)/categories/[slug]/page')
    const ui = await CategoryPage({ params: Promise.resolve({ slug: 'frontend' }) })

    const { container } = render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { level: 1, name: '前端' })).toBeInTheDocument()
    expect(document.querySelector('.reader-banner')).toBeNull()
    expect(screen.getByText('分类')).toHaveClass('ed-eyebrow')
    expect(screen.getByText('1 篇文章 · 最近更新 2026-03-01')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '在列表页中筛选' })).toHaveAttribute('href', '/posts?category=frontend')
    expect(screen.getByRole('link', { name: '全部分类' })).toHaveAttribute('href', '/categories')
    expect(screen.getByRole('heading', { name: '文章 1' })).toBeInTheDocument()
    expect(screen.getByText('按发布时间')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Build Better UI' })[0]).toHaveAttribute('href', '/posts/build-better-ui')
    // 分类详情的列表行 meta 省略分类名
    expect(container.querySelector('.ed-row a[href="/categories/frontend"]')).toBeNull()
    // 只有一页时不渲染页码
    expect(screen.queryByRole('navigation', { name: '分页' })).not.toBeInTheDocument()

    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')
    expect(jsonLd).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: '首页', item: 'https://blog.example/' },
        { name: '分类', item: 'https://blog.example/categories' },
        { name: '前端', item: 'https://blog.example/categories/frontend' },
      ],
    })
  })

  test('/tags/[slug] renders tag article list', async () => {
    const { default: TagPage } = await import('@/app/(public)/tags/[slug]/page')
    const ui = await TagPage({ params: Promise.resolve({ slug: 'nextjs' }) })

    const { container } = render(ui as React.ReactElement)

    // h1 不带「#」，eyebrow 写「标签」
    expect(screen.getByRole('heading', { level: 1, name: 'Next.js' })).toBeInTheDocument()
    expect(screen.getByText('标签')).toHaveClass('ed-eyebrow')
    expect(document.querySelector('.reader-banner')).toBeNull()
    expect(screen.getByRole('link', { name: '在列表页中筛选' })).toHaveAttribute('href', '/posts?tag=nextjs')
    expect(screen.getByRole('link', { name: '全部标签' })).toHaveAttribute('href', '/tags')
    expect(screen.getAllByRole('link', { name: 'Next Patterns' })[0]).toHaveAttribute('href', '/posts/next-patterns')
    // 标签详情的列表行 meta 省略标签名，保留分类
    expect(container.querySelector('.ed-row a[href="/tags/nextjs"]')).toBeNull()
    expect(container.querySelector('.ed-row a[href="/categories/frontend"]')).not.toBeNull()

    const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')
    expect(jsonLd).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: '首页', item: 'https://blog.example/' },
        { name: '标签', item: 'https://blog.example/tags' },
        { name: 'Next.js', item: 'https://blog.example/tags/nextjs' },
      ],
    })
  })

  test('/categories/[slug] shows a safe empty state for out-of-range pages', async () => {
    const { getCategoryDetail } = await import('@/lib/taxonomy')
    vi.mocked(getCategoryDetail).mockResolvedValueOnce({
      id: 'c1',
      name: '前端',
      slug: 'frontend',
      description: '前端工程与交互体验',
      _count: { posts: 1 },
      pagination: { page: 3, limit: 12, total: 1, totalPages: 1 },
      posts: [],
    } as never)

    const { default: CategoryPage } = await import('@/app/(public)/categories/[slug]/page')
    const ui = await CategoryPage({ params: Promise.resolve({ slug: 'frontend' }), searchParams: Promise.resolve({ page: '3' }) } as never)

    render(ui as React.ReactElement)

    expect(screen.getByText('第 3 页不存在，这个分类共 1 页')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '回到第 1 页' })).toHaveAttribute('href', '/categories/frontend?page=1')
  })

  test('/categories/[slug] renders editorial pagination for multi-page categories', async () => {
    const { getCategoryDetail } = await import('@/lib/taxonomy')
    const base = await vi.mocked(getCategoryDetail).getMockImplementation()!('frontend')
    vi.mocked(getCategoryDetail).mockResolvedValueOnce({
      ...base!,
      _count: { posts: 24 },
      pagination: { page: 2, limit: 12, total: 24, totalPages: 2 },
    } as never)

    const { default: CategoryPage } = await import('@/app/(public)/categories/[slug]/page')
    const ui = await CategoryPage({ params: Promise.resolve({ slug: 'frontend' }), searchParams: Promise.resolve({ page: '2' }) } as never)

    render(ui as React.ReactElement)

    const pagination = screen.getByRole('navigation', { name: '分页' })
    expect(pagination).toHaveTextContent('第 2 / 2 页')
    expect(screen.getByRole('link', { name: '上一页' })).toHaveAttribute('href', '/categories/frontend')
    // 非第 1 页不写「最近更新」
    expect(screen.getByText('24 篇文章')).toBeInTheDocument()
  })

  test('/categories/[slug] shows an empty state with two text links', async () => {
    const { getCategoryDetail } = await import('@/lib/taxonomy')
    vi.mocked(getCategoryDetail).mockResolvedValueOnce({
      id: 'c2',
      name: '开源',
      slug: 'open-source',
      description: null,
      _count: { posts: 0 },
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
      posts: [],
    } as never)

    const { default: CategoryPage } = await import('@/app/(public)/categories/[slug]/page')
    const ui = await CategoryPage({ params: Promise.resolve({ slug: 'open-source' }) })

    render(ui as React.ReactElement)

    expect(screen.getByText('这个分类下还没有文章')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '浏览全部文章' })).toHaveAttribute('href', '/posts')
    expect(screen.getAllByRole('link', { name: '全部分类' }).length).toBeGreaterThan(0)
  })
})
