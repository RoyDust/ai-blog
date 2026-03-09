import { beforeEach, describe, expect, test, vi } from 'vitest'

const findMany = vi.fn()
const count = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany,
      count,
    },
  },
}))

describe('GET /api/search', () => {
  beforeEach(() => {
    findMany.mockReset()
    count.mockReset()
  })

  test('searches published posts across related fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'p1',
        title: 'React Search',
        slug: 'react-search',
        excerpt: 'Build search UX',
        coverImage: null,
        createdAt: new Date('2026-03-08T00:00:00Z'),
        author: { id: 'u1', name: 'Ada', image: null },
        category: { name: 'Frontend', slug: 'frontend' },
        tags: [{ name: 'React', slug: 'react' }],
        _count: { comments: 0, likes: 0 },
      },
    ])
    count.mockResolvedValue(1)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react&page=1&limit=12'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.pagination.total).toBe(1)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          published: true,
          deletedAt: null,
          OR: [
            { title: { contains: 'react', mode: 'insensitive' } },
            { excerpt: { contains: 'react', mode: 'insensitive' } },
            { content: { contains: 'react', mode: 'insensitive' } },
            { author: { name: { contains: 'react', mode: 'insensitive' } } },
            { category: { name: { contains: 'react', mode: 'insensitive' } } },
            { tags: { some: { name: { contains: 'react', mode: 'insensitive' } } } },
          ],
        },
        include: expect.any(Object),
        orderBy: [{ createdAt: 'desc' }],
        skip: 0,
        take: 12,
      }),
    )
  })

  test('returns 400 when q is missing', async () => {
    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/query/i)
  })

  test('sorts title matches before body-only matches and returns hit fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'p2',
        title: '前端工程实践',
        slug: 'frontend-engineering',
        excerpt: null,
        content: '这篇文章在正文里提到了 React 搜索的实现细节。',
        coverImage: null,
        createdAt: new Date('2026-03-09T00:00:00Z'),
        author: { id: 'u1', name: 'Ada', image: null },
        category: { name: '前端', slug: 'frontend' },
        tags: [{ name: '工程化', slug: 'engineering' }],
        _count: { comments: 0, likes: 0 },
      },
      {
        id: 'p1',
        title: 'React 搜索体验优化',
        slug: 'react-search-experience',
        excerpt: '统一搜索入口与排序',
        content: '正文',
        coverImage: null,
        createdAt: new Date('2026-03-08T00:00:00Z'),
        author: { id: 'u2', name: 'Grace', image: null },
        category: { name: '体验设计', slug: 'ux' },
        tags: [{ name: 'React', slug: 'react' }],
        _count: { comments: 0, likes: 0 },
      },
    ])
    count.mockResolvedValue(2)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data[0].slug).toBe('react-search-experience')
    expect(payload.data[0].searchMeta.hitFields).toContain('title')
    expect(payload.data[1].searchMeta.hitFields).toContain('content')
    expect(payload.data[0].searchMeta.score).toBeGreaterThan(payload.data[1].searchMeta.score)
  })
})
