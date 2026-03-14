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

describe('taxonomy routes', () => {
  test('/categories renders category directory', async () => {
    const { default: CategoriesPage } = await import('@/app/(public)/categories/page')
    const ui = await CategoriesPage()

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '分类专题' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '前端' })).toHaveAttribute('href', '/categories/frontend')
  })

  test('/tags renders tag directory', async () => {
    const { default: TagsPage } = await import('@/app/(public)/tags/page')
    const ui = await TagsPage()

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '标签专题' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#Next.js' })).toHaveAttribute('href', '/tags/nextjs')
  })

  test('/categories/[slug] renders category article list', async () => {
    const { default: CategoryPage } = await import('@/app/(public)/categories/[slug]/page')
    const ui = await CategoryPage({ params: Promise.resolve({ slug: 'frontend' }) })

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '前端' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Build Better UI' })[0]).toHaveAttribute('href', '/posts/build-better-ui')
  })

  test('/tags/[slug] renders tag article list', async () => {
    const { default: TagPage } = await import('@/app/(public)/tags/[slug]/page')
    const ui = await TagPage({ params: Promise.resolve({ slug: 'nextjs' }) })

    render(ui as React.ReactElement)

    expect(screen.getByRole('heading', { name: '#Next.js' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Next Patterns' })[0]).toHaveAttribute('href', '/posts/next-patterns')
  })
})
