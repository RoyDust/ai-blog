import { beforeEach, describe, expect, test, vi } from 'vitest'

const findFirst = vi.fn()
const update = vi.fn()
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
      findFirst,
      update,
    },
  },
}))

describe('PATCH /api/admin/posts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolvePostCoverInput.mockResolvedValue({
      coverImage: undefined,
      coverAssetId: undefined,
      selectedAssetId: null,
    })
    touchCoverAssetUsage.mockResolvedValue(undefined)
  })

  test('recomputes reading time when updating a post', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    findFirst.mockResolvedValueOnce({
      slug: 'old-slug',
      coverImage: 'https://cdn.example.com/old.jpg',
      category: { slug: 'old-category' },
      tags: [{ slug: 'legacy-tag' }],
    })
    calculateReadingTimeMinutes.mockReturnValueOnce(6)
    update.mockResolvedValueOnce({
      id: 'post-1',
      slug: 'new-slug',
      published: true,
      readingTimeMinutes: 6,
      category: { slug: 'new-category' },
      tags: [{ slug: 'fresh-tag' }],
    })

    const { PATCH } = await import('../route')
    const response = await PATCH(
      new Request('http://localhost/api/admin/posts/post-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Updated title',
          slug: 'new-slug',
          content: '更新后的正文内容',
          excerpt: '新的摘要',
          coverImage: '',
          categoryId: 'cat-2',
          tagIds: ['tag-2'],
          published: true,
        }),
      }),
      { params: Promise.resolve({ id: 'post-1' }) },
    )

    expect(response.status).toBe(200)
    expect(calculateReadingTimeMinutes).toHaveBeenCalledWith('更新后的正文内容')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        readingTimeMinutes: 6,
      }),
    }))
    expect(revalidatePublicContent).toHaveBeenCalled()
  })
})
