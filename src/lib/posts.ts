import { prisma } from '@/lib/prisma'

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
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
        category: true,
        tags: true,
        _count: {
          select: { comments: true, likes: true },
        },
      },
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
