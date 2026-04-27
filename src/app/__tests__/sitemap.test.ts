import { beforeEach, describe, expect, test, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  postFindMany: vi.fn(),
  categoryFindMany: vi.fn(),
  tagFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findMany: prismaMocks.postFindMany },
    category: { findMany: prismaMocks.categoryFindMany },
    tag: { findMany: prismaMocks.tagFindMany },
  },
}))

describe('sitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top'
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'

    prismaMocks.postFindMany.mockResolvedValue([
      { slug: 'featured-post', updatedAt: new Date('2026-04-01T00:00:00Z'), featured: true },
      { slug: 'regular-post', updatedAt: new Date('2026-03-01T00:00:00Z'), featured: false },
    ])
    prismaMocks.categoryFindMany.mockResolvedValue([
      {
        slug: 'engineering',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        posts: [{ updatedAt: new Date('2026-04-10T00:00:00Z') }],
        _count: { posts: 2 },
      },
      { slug: 'empty', createdAt: new Date('2026-01-01T00:00:00Z'), posts: [], _count: { posts: 0 } },
    ])
    prismaMocks.tagFindMany.mockResolvedValue([
      {
        slug: 'nextjs',
        createdAt: new Date('2026-01-02T00:00:00Z'),
        posts: [{ updatedAt: new Date('2026-04-11T00:00:00Z') }],
        _count: { posts: 1 },
      },
      { slug: 'unused', createdAt: new Date('2026-01-02T00:00:00Z'), posts: [], _count: { posts: 0 } },
    ])
  })

  test('builds public canonical routes and omits utility pages', async () => {
    const { default: sitemap } = await import('../sitemap')
    const entries = await sitemap()
    const urls = entries.map((entry) => entry.url)

    expect(prismaMocks.postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { published: true, deletedAt: null },
      }),
    )
    expect(urls).toContain('http://roydust.top/')
    expect(urls).toContain('http://roydust.top/posts')
    expect(urls).toContain('http://roydust.top/archives')
    expect(urls).toContain('http://roydust.top/posts/featured-post')
    expect(urls).toContain('http://roydust.top/categories/engineering')
    expect(urls).toContain('http://roydust.top/tags/nextjs')
    expect(urls).not.toContain('http://roydust.top/search')
    expect(urls).not.toContain('http://roydust.top/bookmarks')
    expect(urls).not.toContain('http://roydust.top/categories/empty')
    expect(urls).not.toContain('http://roydust.top/tags/unused')
    expect(entries.find((entry) => entry.url === 'http://roydust.top/categories/engineering')?.lastModified).toEqual(
      new Date('2026-04-10T00:00:00Z'),
    )
    expect(entries.find((entry) => entry.url === 'http://roydust.top/tags/nextjs')?.lastModified).toEqual(
      new Date('2026-04-11T00:00:00Z'),
    )
  })
})
