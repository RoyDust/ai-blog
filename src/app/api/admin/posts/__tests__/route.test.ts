import { beforeEach, describe, expect, test, vi } from 'vitest'

const create = vi.fn()
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
    post: {
      create,
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
})
