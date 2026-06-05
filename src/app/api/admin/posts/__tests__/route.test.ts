import { beforeEach, describe, expect, test, vi } from 'vitest'

const create = vi.fn()
const findMany = vi.fn()
const count = vi.fn()
const aggregate = vi.fn()
const postUpdateMany = vi.fn()
const commentUpdateMany = vi.fn()
const transaction = vi.fn()
const getServerSession = vi.fn()
const revalidatePublicContent = vi.fn()
const calculateReadingTimeMinutes = vi.fn()
const resolvePostCoverInput = vi.fn()
const touchCoverAssetUsage = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/cache', () => ({
  revalidatePublicContent,
}))

vi.mock('@/lib/reading-time', () => ({
  calculateReadingTimeMinutes,
}))

vi.mock('@/lib/cover-assets', () => ({
  resolvePostCoverInput,
  touchCoverAssetUsage,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: transaction,
    post: {
      aggregate,
      count,
      create,
      findMany,
      updateMany: postUpdateMany,
    },
    comment: {
      updateMany: commentUpdateMany,
    },
  },
}))

describe('POST /api/admin/posts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvePostCoverInput.mockResolvedValue({
      coverImage: undefined,
      coverAssetId: undefined,
      selectedAssetId: null,
    })
    touchCoverAssetUsage.mockResolvedValue(undefined)
    transaction.mockImplementation(async (operations) => Promise.all(operations))
  })

  test('paginates and filters the admin post list on the server', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    count.mockResolvedValueOnce(42).mockResolvedValueOnce(120).mockResolvedValueOnce(90)
    aggregate.mockResolvedValueOnce({ _sum: { viewCount: 1234 } })
    findMany.mockResolvedValueOnce([{ id: 'post-21', title: 'AI Draft' }])

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/admin/posts?page=3&limit=10&status=draft&q=ai&type=non-ai-daily'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 10,
      where: expect.objectContaining({
        published: false,
        generatedByAiNews: false,
        OR: expect.any(Array),
      }),
    }))
    expect(payload.pagination).toEqual({ page: 3, limit: 10, total: 42, totalPages: 5 })
    expect(payload.stats).toEqual({ total: 120, published: 90, drafts: 30, views: 1234 })
  })

  test('stores calculated reading time when creating a post', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    calculateReadingTimeMinutes.mockReturnValueOnce(4)
    create.mockResolvedValueOnce({
      id: 'post-1',
      slug: 'hello-world',
      published: true,
      readingTimeMinutes: 4,
      category: { slug: 'engineering' },
      series: null,
      tags: [{ slug: 'nextjs' }],
    })

    const { POST } = await import('../route')
    const response = await POST(
      new Request('http://localhost/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Hello World',
          slug: 'hello-world',
          content: '正文内容',
          excerpt: '摘要',
          coverImage: '',
          categoryId: 'cat-1',
          tagIds: ['tag-1'],
          published: true,
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(calculateReadingTimeMinutes).toHaveBeenCalledWith('正文内容')
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        readingTimeMinutes: 4,
      }),
    }))
    expect(revalidatePublicContent).toHaveBeenCalled()
  })

  test('creates scheduled series posts as unpublished', async () => {
    const scheduledAt = new Date(Date.now() + 60_000)
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    calculateReadingTimeMinutes.mockReturnValueOnce(5)
    create.mockResolvedValueOnce({
      id: 'post-2',
      slug: 'scheduled-post',
      published: false,
      scheduledAt,
      readingTimeMinutes: 5,
      category: null,
      series: { slug: 'nextjs-series' },
      tags: [],
    })

    const { POST } = await import('../route')
    const response = await POST(
      new Request('http://localhost/api/admin/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Scheduled Post',
          slug: 'scheduled-post',
          content: '正文内容',
          seriesId: 'series-1',
          seriesOrder: 2,
          scheduledAt: scheduledAt.toISOString(),
          published: true,
        }),
      }),
    )

    expect(response.status).toBe(200)
    const createArgs = create.mock.calls[0]?.[0]
    expect(createArgs.data).toMatchObject({
      seriesId: 'series-1',
      seriesOrder: 2,
      published: false,
      publishedAt: null,
    })
    expect(createArgs.data.scheduledAt).toEqual(scheduledAt)
    expect(revalidatePublicContent).not.toHaveBeenCalled()
  })

  test('deleting posts revalidates previous series paths', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    findMany.mockResolvedValueOnce([
      {
        id: 'post-1',
        slug: 'old-post',
        category: { slug: 'engineering' },
        series: { slug: 'nextjs-series' },
        tags: [{ slug: 'nextjs' }],
      },
    ])
    postUpdateMany.mockResolvedValueOnce({ count: 1 })
    commentUpdateMany.mockResolvedValueOnce({ count: 0 })

    const { DELETE } = await import('../route')
    const response = await DELETE(new Request('http://localhost/api/admin/posts?ids=post-1', { method: 'DELETE' }))

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        series: { select: { slug: true } },
      }),
    }))
    expect(revalidatePublicContent).toHaveBeenCalledWith({
      previousSlug: 'old-post',
      previousCategorySlug: 'engineering',
      previousSeriesSlug: 'nextjs-series',
      previousTagSlugs: ['nextjs'],
    })
  })
})
