import { beforeEach, expect, test, vi } from 'vitest'
import categoryCatalog from '../../../scripts/category-catalog.json'

const categoryFindFirst = vi.fn()
const postFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findFirst: categoryFindFirst,
    },
    post: {
      findMany: postFindMany,
    },
  },
}))

test('category catalog includes common blog sections with stable slugs', () => {
  const names = categoryCatalog.map((category) => category.name)

  expect(names).toEqual(expect.arrayContaining([
    '前端开发',
    '后端开发',
    '工程实践',
    '性能优化',
    '设计系统',
    '产品与体验',
    '数据库',
    '部署与运维',
  ]))

  expect(categoryCatalog.find((category) => category.name === '前端开发')?.slug).toBe('frontend')
  expect(categoryCatalog.find((category) => category.name === '工程实践')?.slug).toBe('engineering')
  expect(categoryCatalog.find((category) => category.name === '部署与运维')?.slug).toBe('deployment-ops')
})

beforeEach(() => {
  categoryFindFirst.mockReset()
  postFindMany.mockReset()
})

test('category detail fetches the requested page with deterministic pagination metadata', async () => {
  categoryFindFirst.mockResolvedValue({
    id: 'c1',
    name: '前端开发',
    slug: 'frontend',
    description: 'desc',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    _count: { posts: 13 },
  })
  postFindMany.mockResolvedValue([])

  const { getCategoryDetail } = await import('../taxonomy')
  const result = await getCategoryDetail('frontend', { page: 2, limit: 12 })

  expect(postFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { deletedAt: null, published: true, category: { slug: 'frontend' } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: 12,
      take: 12,
    }),
  )
  expect(result?.pagination).toEqual({ page: 2, limit: 12, total: 13, totalPages: 2 })
})
