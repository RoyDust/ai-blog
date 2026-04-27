import { beforeEach, describe, expect, test, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  postFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findMany: prismaMocks.postFindMany },
  },
}))

describe('GET /rss.xml', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top'
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'
  })

  test('emits published non-deleted posts with canonical links', async () => {
    prismaMocks.postFindMany.mockResolvedValueOnce([
      {
        title: 'Hello RSS',
        slug: 'hello-rss',
        excerpt: 'Excerpt',
        seoDescription: 'SEO Description',
        createdAt: new Date('2026-03-01T00:00:00Z'),
        updatedAt: new Date('2026-03-03T00:00:00Z'),
        publishedAt: new Date('2026-03-02T00:00:00Z'),
      },
    ])

    const { GET } = await import('../route')
    const response = await GET()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/rss+xml; charset=utf-8')
    expect(prismaMocks.postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { published: true, deletedAt: null },
        orderBy: [{ publishedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      }),
    )
    expect(body).toContain('<rss version="2.0">')
    expect(body).toContain('<lastBuildDate>Tue, 03 Mar 2026 00:00:00 GMT</lastBuildDate>')
    expect(body).toContain('<link>http://roydust.top/posts/hello-rss</link>')
    expect(body).toContain('<description><![CDATA[SEO Description]]></description>')
    expect(body).toContain('<pubDate>Mon, 02 Mar 2026 00:00:00 GMT</pubDate>')
  })

  test('returns an explicit error when feed generation fails', async () => {
    prismaMocks.postFindMany.mockRejectedValueOnce(new Error('db unavailable'))

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(500)
    expect(await response.text()).toBe('RSS feed generation failed')
  })
})
