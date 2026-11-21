import { createPublicCachedReader, PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from '@/lib/cache'
import { TAXONOMY_PAGE_SIZE } from '@/lib/pagination'
import {
  buildOffsetPagination,
  getPublicPostSelect,
  PUBLIC_POST_ORDER_BY,
  rehydratePublicPostRecord,
  type PublicPostRecord,
} from '@/lib/posts'
import { prisma } from '@/lib/prisma'

export { TAXONOMY_PAGE_SIZE } from '@/lib/pagination'

interface TaxonomyDetailPaginationInput {
  page?: number
  limit?: number
}

function reviveCreatedAt<T extends { createdAt?: unknown }>(record: T): T {
  if (typeof record.createdAt !== 'string') {
    return record
  }

  return {
    ...record,
    createdAt: new Date(record.createdAt),
  }
}

async function queryCategoryDirectory() {
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

const getCachedCategoryDirectory = createPublicCachedReader(queryCategoryDirectory, {
  keyParts: ['public-category-directory'],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.posts],
  rehydrate: (categories) => categories.map(reviveCreatedAt),
})

export async function getCategoryDirectory() {
  return getCachedCategoryDirectory()
}

async function queryTagDirectory() {
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

const getCachedTagDirectory = createPublicCachedReader(queryTagDirectory, {
  keyParts: ['public-tag-directory'],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.tags, PUBLIC_CACHE_TAGS.posts],
  rehydrate: (tags) => tags.map(reviveCreatedAt),
})

export async function getTagDirectory() {
  return getCachedTagDirectory()
}

async function queryCategoryDetail(slug: string, page: number, limit: number) {
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

  const posts = (await prisma.post.findMany({
    where: { deletedAt: null, published: true, category: { id: category.id, deletedAt: null } },
    select: getPublicPostSelect({ includeTagColor: true }),
    orderBy: PUBLIC_POST_ORDER_BY,
    skip: (page - 1) * limit,
    take: limit,
  })) as unknown as PublicPostRecord[]

  return {
    ...category,
    posts,
    pagination: buildOffsetPagination({ page, limit, total: category._count.posts }),
  }
}

const getCachedCategoryDetail = createPublicCachedReader(queryCategoryDetail, {
  keyParts: ['public-category-detail'],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.tags],
  rehydrate: (detail) => {
    if (!detail) {
      return null
    }

    return {
      ...reviveCreatedAt(detail),
      posts: detail.posts.map(rehydratePublicPostRecord),
    }
  },
})

export async function getCategoryDetail(slug: string, input: TaxonomyDetailPaginationInput = {}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.max(1, input.limit ?? TAXONOMY_PAGE_SIZE)

  return getCachedCategoryDetail(slug, page, limit)
}

async function queryTagDetail(slug: string, page: number, limit: number) {
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

  const posts = (await prisma.post.findMany({
    where: { deletedAt: null, published: true, tags: { some: { id: tag.id, deletedAt: null } } },
    select: getPublicPostSelect({ includeTagColor: true }),
    orderBy: PUBLIC_POST_ORDER_BY,
    skip: (page - 1) * limit,
    take: limit,
  })) as unknown as PublicPostRecord[]

  return {
    ...tag,
    posts,
    pagination: buildOffsetPagination({ page, limit, total: tag._count.posts }),
  }
}

const getCachedTagDetail = createPublicCachedReader(queryTagDetail, {
  keyParts: ['public-tag-detail'],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.tags, PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.categories],
  rehydrate: (detail) => {
    if (!detail) {
      return null
    }

    return {
      ...reviveCreatedAt(detail),
      posts: detail.posts.map(rehydratePublicPostRecord),
    }
  },
})

export async function getTagDetail(slug: string, input: TaxonomyDetailPaginationInput = {}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.max(1, input.limit ?? TAXONOMY_PAGE_SIZE)

  return getCachedTagDetail(slug, page, limit)
}
