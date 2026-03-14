import { prisma } from '@/lib/prisma'

export const TAXONOMY_PAGE_SIZE = 12

const taxonomyPostSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverImage: true,
  createdAt: true,
  viewCount: true,
  author: {
    select: { id: true, name: true, image: true },
  },
  category: {
    select: { id: true, name: true, slug: true },
  },
  tags: {
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true, color: true },
  },
  _count: {
    select: { comments: { where: { deletedAt: null } }, likes: true },
  },
} as const

interface TaxonomyDetailPaginationInput {
  page?: number
  limit?: number
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
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
    select: taxonomyPostSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * limit,
    take: limit,
  })

  return {
    ...category,
    posts,
    pagination: buildPagination(page, limit, category._count.posts),
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
    select: taxonomyPostSelect,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * limit,
    take: limit,
  })

  return {
    ...tag,
    posts,
    pagination: buildPagination(page, limit, tag._count.posts),
  }
}
