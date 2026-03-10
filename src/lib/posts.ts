import { prisma } from '@/lib/prisma'

const postListingSelect = {
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
    select: { id: true, name: true, slug: true },
  },
  _count: {
    select: { comments: { where: { deletedAt: null } }, likes: true },
  },
} as const

interface PublishedPostsPageInput {
  page: number
  limit: number
  category?: string | null
  tag?: string | null
  search?: string | null
}

export async function getPublishedPostsPage({
  page,
  limit,
  category,
  tag,
  search,
}: PublishedPostsPageInput) {
  const where: NonNullable<Parameters<typeof prisma.post.findMany>[0]>['where'] = {
    published: true,
    deletedAt: null,
  }

  if (category) {
    where.category = { slug: category }
  }

  if (tag) {
    where.tags = { some: { slug: tag } }
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: postListingSelect,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.post.count({ where }),
  ])

  return {
    posts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}
