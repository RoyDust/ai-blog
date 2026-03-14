import { prisma } from '@/lib/prisma'
import { TAXONOMY_PAGE_SIZE } from '@/lib/pagination'
import { buildOffsetPagination, getPublicPostSelect, PUBLIC_POST_ORDER_BY, type PublicPostRecord } from '@/lib/posts'

export { TAXONOMY_PAGE_SIZE } from '@/lib/pagination'

interface TaxonomyDetailPaginationInput {
  page?: number
  limit?: number
}

export async function getCategoryDirectory() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

export async function getTagDirectory() {
  return prisma.tag.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

export async function getCategoryDetail(slug: string, input: TaxonomyDetailPaginationInput = {}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.max(1, input.limit ?? TAXONOMY_PAGE_SIZE)

  const category = await prisma.category.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
  })

  if (!category) {
    return null
  }

  const posts = await prisma.post.findMany({
    where: { deletedAt: null, published: true, category: { slug } },
    select: getPublicPostSelect({ includeTagColor: true }),
    orderBy: PUBLIC_POST_ORDER_BY,
    skip: (page - 1) * limit,
    take: limit,
  }) as unknown as PublicPostRecord[]

  return {
    ...category,
    posts,
    pagination: buildOffsetPagination({ page, limit, total: category._count.posts }),
  }
}

export async function getTagDetail(slug: string, input: TaxonomyDetailPaginationInput = {}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.max(1, input.limit ?? TAXONOMY_PAGE_SIZE)

  const tag = await prisma.tag.findFirst({
    where: { slug, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      color: true,
      createdAt: true,
      _count: {
        select: { posts: { where: { deletedAt: null, published: true } } },
      },
    },
  })

  if (!tag) {
    return null
  }

  const posts = await prisma.post.findMany({
    where: { deletedAt: null, published: true, tags: { some: { slug } } },
    select: getPublicPostSelect({ includeTagColor: true }),
    orderBy: PUBLIC_POST_ORDER_BY,
    skip: (page - 1) * limit,
    take: limit,
  }) as unknown as PublicPostRecord[]

  return {
    ...tag,
    posts,
    pagination: buildOffsetPagination({ page, limit, total: tag._count.posts }),
  }
}
