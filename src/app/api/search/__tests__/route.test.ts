import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const findMany = vi.fn()
const queryRaw = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany,
    },
    $queryRaw: queryRaw,
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
    queryRaw.mockReset()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    process.env = { ...originalEnv }
  })

  test('searches published posts across related fields', async () => {
    queryRaw.mockResolvedValue([{ total: 1, items: [{ id: 'p1', score: 31, hitFields: ['title', 'excerpt', 'content', 'author', 'category', 'tags'] }] }])
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

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react&page=1&limit=12'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.pagination.total).toBe(1)
    expect(payload.data[0].searchMeta).toEqual({
      score: 31,
      hitFields: ['title', 'excerpt', 'content', 'author', 'category', 'tags'],
    })
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
    expect(queryRaw).not.toHaveBeenCalled()
  })

  test('returns 400 when q exceeds the public search maximum', async () => {
    const { GET } = await import('../route')
    const response = await GET(new Request(`http://localhost/api/search?q=${'a'.repeat(201)}`))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Query must be at most 200 characters' })
    expect(findMany).not.toHaveBeenCalled()
    expect(queryRaw).not.toHaveBeenCalled()
  })

  test('normalizes invalid page and limit values through shared pagination validation', async () => {
    queryRaw.mockResolvedValue([{ total: 0, items: [] }])
    findMany.mockResolvedValue([])

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
    expect(findMany).not.toHaveBeenCalled()
  })

  test('preserves the database global order and returns hit fields', async () => {
    queryRaw.mockResolvedValue([
      {
        total: 2,
        items: [
          { id: 'p1', score: 12, hitFields: ['title'] },
          { id: 'p2', score: 4, hitFields: ['content'] },
        ],
      },
    ])
    findMany.mockResolvedValue([
      {
        ...searchPost,
        id: 'p1',
        title: 'React 搜索体验优化',
        slug: 'react-search-experience',
        excerpt: null,
        content: '正文',
        createdAt: new Date('2026-03-08T00:00:00Z'),
      },
      {
        ...searchPost,
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
    ])

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data[0].slug).toBe('react-search-experience')
    expect(payload.data.map((item: { slug: string }) => item.slug)).toEqual([
      'react-search-experience',
      'frontend-engineering',
    ])
    expect(payload.data[0].searchMeta).toEqual({ score: 12, hitFields: ['title'] })
    expect(payload.data[1].searchMeta).toEqual({ score: 4, hitFields: ['content'] })
  })

  test('returns the public error contract without leaking internal details on failures', async () => {
    queryRaw.mockRejectedValueOnce(new Error('database exploded with internals'))

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=react'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'Internal server error' })
    expect(JSON.stringify(payload)).not.toMatch(/database exploded|internals/i)
  })

  test('adds AI search summary and reorders candidates when requested', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    queryRaw.mockResolvedValue([
      {
        total: 2,
        items: [
          { id: 'p1', score: 12, hitFields: ['title'] },
          { id: 'p2', score: 12, hitFields: ['title'] },
        ],
      },
    ])
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
    queryRaw.mockResolvedValue([{ total: 1, items: [{ id: 'p1', score: 12, hitFields: ['title'] }] }])
    findMany.mockResolvedValue([searchPost])
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

  test('keeps ordinary search results when AI enhancement fails', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    queryRaw.mockResolvedValue([{ total: 1, items: [{ id: 'p1', score: 12, hitFields: ['title'] }] }])
    findMany.mockResolvedValue([searchPost])
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('upstream timeout')))

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=搜索&ai=1'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toHaveLength(1)
    expect(payload.ai).toBeUndefined()
  })

  test('rate-limits uncached AI search summary requests by client', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    queryRaw.mockImplementation(async () => [{ total: 1, items: [{ id: 'p1', score: 12, hitFields: ['title'] }] }])
    findMany.mockResolvedValue([searchPost])
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

  test('evicts expired AI search cache entries after TTL elapses', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    queryRaw.mockResolvedValue([{ total: 1, items: [{ id: 'p1', score: 12, hitFields: ['title'] }] }])
    findMany.mockResolvedValue([searchPost])

    let callCount = 0
    const fetchMock = vi.fn().mockImplementation(async () => {
      callCount += 1
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: `AI 摘要 #${callCount}`,
                  rankedSlugs: ['react-search-experience'],
                }),
              },
            },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const { GET } = await import('../route')
    const first = await GET(new Request('http://localhost/api/search?q=缓存过期&ai=1', { headers: { 'x-real-ip': '198.51.100.10' } }))
    expect((await first.json()).ai).toEqual({ summary: 'AI 摘要 #1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(4 * 60_000)
    const withinTtl = await GET(new Request('http://localhost/api/search?q=缓存过期&ai=1', { headers: { 'x-real-ip': '198.51.100.10' } }))
    expect((await withinTtl.json()).ai).toEqual({ summary: 'AI 摘要 #1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_001)
    const afterTtl = await GET(new Request('http://localhost/api/search?q=缓存过期&ai=1', { headers: { 'x-real-ip': '198.51.100.10' } }))
    expect((await afterTtl.json()).ai).toEqual({ summary: 'AI 摘要 #2' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('bounds AI search cache size by sweeping expired entries first and evicting least-recently-used entries at capacity', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    queryRaw.mockResolvedValue([{ total: 1, items: [{ id: 'p1', score: 12, hitFields: ['title'] }] }])
    findMany.mockResolvedValue([searchPost])

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ summary: 'AI 容量测试摘要', rankedSlugs: ['react-search-experience'] }) } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { GET } = await import('../route')
    const ipFor = (index: number) => `10.20.${Math.floor(index / 250)}.${(index % 250) + 1}`

    // Seed entry 0 early so it expires before entries 1..499.
    await GET(new Request('http://localhost/api/search?q=词条0&ai=1', { headers: { 'x-real-ip': ipFor(0) } }))

    vi.advanceTimersByTime(3 * 60_000)
    for (let index = 1; index < 500; index += 1) {
      await GET(new Request(`http://localhost/api/search?q=词条${index}&ai=1`, { headers: { 'x-real-ip': ipFor(index) } }))
    }
    expect(fetchMock).toHaveBeenCalledTimes(500)

    // Advance past entry 0's 5m TTL while entries 1..499 still have ~2m remaining.
    vi.advanceTimersByTime(2 * 60_000 + 1)

    // Adding entry 500 sweeps expired entry 0 instead of evicting unexpired entry 1.
    await GET(new Request('http://localhost/api/search?q=词条500&ai=1', { headers: { 'x-real-ip': ipFor(500) } }))
    expect(fetchMock).toHaveBeenCalledTimes(501)

    // Touch entry 1: still cached (cache hit) and promoted to most-recently-used; entry 2 is now LRU.
    await GET(new Request('http://localhost/api/search?q=词条1&ai=1', { headers: { 'x-real-ip': ipFor(501) } }))
    expect(fetchMock).toHaveBeenCalledTimes(501)

    // Cache now holds 500 active entries (1..500 with 1 MRU, 2 LRU). Adding entry 501 evicts LRU entry 2.
    await GET(new Request('http://localhost/api/search?q=词条501&ai=1', { headers: { 'x-real-ip': ipFor(502) } }))
    expect(fetchMock).toHaveBeenCalledTimes(502)

    // Entry 1 remains cached, whereas evicted entry 2 triggers a fresh upstream completion call.
    await GET(new Request('http://localhost/api/search?q=词条1&ai=1', { headers: { 'x-real-ip': ipFor(503) } }))
    expect(fetchMock).toHaveBeenCalledTimes(502)

    await GET(new Request('http://localhost/api/search?q=词条2&ai=1', { headers: { 'x-real-ip': ipFor(504) } }))
    expect(fetchMock).toHaveBeenCalledTimes(503)
  })

  test('feeds bounded 220-char contentSnippet to AI search when excerpt is null and strips content/admin fields from response', async () => {
    process.env.DASHSCOPE_API_KEY = 'test-api-key'
    const rawPrefix = `前缀上下文-${'正'.repeat(240)}`
    queryRaw.mockResolvedValue([
      {
        total: 1,
        items: [
          {
            id: 'p-no-excerpt',
            score: 16,
            hitFields: ['title', 'content'],
            contentSnippet: rawPrefix.slice(0, 240),
          },
        ],
      },
    ])
    findMany.mockResolvedValue([
      {
        id: 'p-no-excerpt',
        title: '无摘要文章的 AI 搜索',
        slug: 'excerptless-ai-search',
        excerpt: null,
        content: '完整超长正文不应泄露'.repeat(50),
        coverImage: null,
        createdAt: new Date('2026-03-15T00:00:00Z'),
        authorId: 'u-internal',
        summaryError: 'internal summary failure',
        summaryJobId: 'job-123',
        summaryModelId: 'model-summary',
        seoModelId: 'model-seo',
        coverAssetId: 'cover-asset-1',
        scheduledAt: new Date('2026-04-01T00:00:00Z'),
        deletedAt: null,
        author: { id: 'u1', name: 'Ada', image: null },
        category: { name: 'AI', slug: 'ai' },
        tags: [{ name: 'Search', slug: 'search' }],
        _count: { comments: 1, likes: 3 },
      },
    ])

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'AI 基于正文前 220 字生成了推荐摘要。',
                rankedSlugs: ['excerptless-ai-search'],
              }),
            },
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/search?q=搜索&ai=1', { headers: { 'x-real-ip': '198.51.100.88' } }))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.ai).toEqual({ summary: 'AI 基于正文前 220 字生成了推荐摘要。' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const upstreamBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))
    const promptText = String(upstreamBody.messages?.[1]?.content ?? '')
    expect(promptText).toContain(rawPrefix.slice(0, 220))
    expect(promptText).not.toContain('完整超长正文不应泄露')

    const item = payload.data[0]
    expect(item).not.toHaveProperty('content')
    expect(item).not.toHaveProperty('contentSnippet')
    for (const forbiddenField of [
      'authorId',
      'summaryError',
      'summaryJobId',
      'summaryModelId',
      'seoModelId',
      'coverAssetId',
      'scheduledAt',
      'deletedAt',
    ]) {
      expect(item).not.toHaveProperty(forbiddenField)
    }
  })
})
