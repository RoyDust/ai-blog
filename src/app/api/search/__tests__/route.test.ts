import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

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

const searchPost = {
  id: 'p1',
  title: 'React 搜索体验优化',
  slug: 'react-search-experience',
  excerpt: '统一搜索入口与排序',
  content: '正文',
  coverImage: null,
  createdAt: new Date('2026-03-08T00:00:00Z'),
  author: { id: 'u1', name: 'Ada', image: null },
  category: { name: '前端', slug: 'frontend' },
  tags: [{ name: 'React', slug: 'react' }],
  _count: { comments: 0, likes: 0 },
}

describe('GET /api/search', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    findMany.mockReset()
    count.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
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
    expect(payload).toEqual({ error: 'Query is required' })
    expect(payload.error).toMatch(/query/i)
  })

  test('returns 400 when q is shorter than the public search minimum', async () => {
    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=a'))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Query must be at least 2 characters' })
    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
  })

  test('normalizes invalid page and limit values through shared pagination validation', async () => {
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react&page=-9&limit=500'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.pagination).toEqual({
      page: 1,
      limit: 50,
      total: 0,
      totalPages: 0,
    })
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 50,
      }),
    )
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
      searchPost,
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

  test('returns the public error contract without leaking internal details on failures', async () => {
    findMany.mockRejectedValueOnce(new Error('database exploded with internals'))
    count.mockResolvedValueOnce(0)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'Internal server error' })
    expect(JSON.stringify(payload)).not.toMatch(/database exploded|internals/i)
  })

  test('adds AI search summary and reorders candidates when requested', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    findMany.mockResolvedValue([
      searchPost,
      {
        id: 'p2',
        title: 'Next.js 深度搜索实践',
        slug: 'nextjs-deep-search',
        excerpt: '用模型总结搜索结果',
        content: '正文',
        coverImage: null,
        createdAt: new Date('2026-03-09T00:00:00Z'),
        author: { id: 'u2', name: 'Grace', image: null },
        category: { name: 'AI', slug: 'ai' },
        tags: [{ name: 'Next.js', slug: 'nextjs' }],
        _count: { comments: 0, likes: 0 },
      },
    ])
    count.mockResolvedValue(2)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'AI 建议优先阅读 Next.js 深度搜索实践。',
                  rankedSlugs: ['nextjs-deep-search', 'react-search-experience'],
                }),
              },
            },
          ],
        }),
      }),
    )

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=搜索&ai=1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ai).toMatchObject({ summary: 'AI 建议优先阅读 Next.js 深度搜索实践。' })
    expect(payload.data.map((item: { slug: string }) => item.slug)).toEqual(['nextjs-deep-search', 'react-search-experience'])
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/chat/completions'), expect.objectContaining({ method: 'POST' }))
  })

  test('reuses cached AI search summaries for the same ranked candidates', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    findMany.mockResolvedValue([searchPost])
    count.mockResolvedValue(1)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ summary: 'AI 建议阅读 React 搜索体验优化。', rankedSlugs: ['react-search-experience'] }) } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { GET } = await import('../route')
    const first = await GET(new Request('http://localhost/api/search?q=搜索&ai=1'))
    const second = await GET(new Request('http://localhost/api/search?q=搜索&ai=1'))
    const firstPayload = await first.json()
    const secondPayload = await second.json()

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(firstPayload.ai).toEqual(secondPayload.ai)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('rate-limits uncached AI search summary requests by client', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    findMany.mockResolvedValue([searchPost])
    count.mockResolvedValue(1)
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ summary: 'AI 摘要', rankedSlugs: ['react-search-experience'] }) } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { GET } = await import('../route')
    const responses = []
    for (let index = 0; index < 9; index += 1) {
      responses.push(
        await GET(
          new Request(`http://localhost/api/search?q=搜索${index}&ai=1`, {
            headers: { 'x-forwarded-for': '203.0.113.8' },
          }),
        ),
      )
    }
    const blockedPayload = await responses[8].json()

    expect(responses.slice(0, 8).map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 200, 200, 200])
    expect(responses[8].status).toBe(429)
    expect(blockedPayload).toEqual({ error: 'Too many AI search requests' })
    expect(fetchMock).toHaveBeenCalledTimes(8)
  })
})
