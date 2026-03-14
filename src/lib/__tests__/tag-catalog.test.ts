import { beforeEach, expect, test, vi } from 'vitest'
import tagCatalog from '../../../scripts/tag-catalog.json'

const tagFindFirst = vi.fn()
const postFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tag: {
      findFirst: tagFindFirst,
    },
    post: {
      findMany: postFindMany,
    },
  },
}))

test('tag catalog includes common and engineering tags with stable slugs', () => {
  const names = tagCatalog.map((tag) => tag.name)

  expect(names).toEqual(expect.arrayContaining([
    'Next.js',
    'React',
    'TypeScript',
    'Prisma',
    '工程化',
    '前端架构',
    '组件设计',
    '代码规范',
    '测试',
    'CI/CD',
    '可观测性',
  ]))

  expect(tagCatalog.find((tag) => tag.name === 'Next.js')?.slug).toBe('nextjs')
  expect(tagCatalog.find((tag) => tag.name === '前端架构')?.slug).toBe('frontend-architecture')
  expect(tagCatalog.find((tag) => tag.name === 'CI/CD')?.slug).toBe('ci-cd')
})

beforeEach(() => {
  tagFindFirst.mockReset()
  postFindMany.mockReset()
})

test('tag detail fetches the requested page with deterministic pagination metadata', async () => {
  tagFindFirst.mockResolvedValue({
    id: 't1',
    name: 'Next.js',
    slug: 'nextjs',
    color: '#000000',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    _count: { posts: 24 },
  })
  postFindMany.mockResolvedValue([])

  const { getTagDetail } = await import('../taxonomy')
  const result = await getTagDetail('nextjs', { page: 3, limit: 12 })

  expect(postFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { deletedAt: null, published: true, tags: { some: { slug: 'nextjs' } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 24,
      take: 12,
    }),
  )
  expect(result?.pagination).toEqual({ page: 3, limit: 12, total: 24, totalPages: 2 })
})
