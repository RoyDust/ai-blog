import { prisma } from '@/lib/prisma'

type PostFindManyArgs = NonNullable<Parameters<typeof prisma.post.findMany>[0]>
type PublicPostSelect = NonNullable<PostFindManyArgs['select']>
type PublicPostOrderBy = Exclude<PostFindManyArgs['orderBy'], undefined>

export interface PublicPostRecord {
  id: string
  title: string
  slug: string
  excerpt: string | null
  coverImage: string | null
  createdAt: Date
  viewCount: number
  author: {
    id: string
    name: string | null
    image: string | null
  }
  category: {
    id: string
    name: string
    slug: string
  } | null
  tags: Array<{
    id: string
    name: string
    slug: string
    color?: string | null
  }>
  _count: {
    comments: number
    likes: number
  }
}

export const PUBLIC_POST_ORDER_BY: PublicPostOrderBy = [{ createdAt: 'desc' }, { id: 'desc' }]

export function getPublicPostSelect(options: { includeTagColor?: boolean } = {}): PublicPostSelect {
  return {
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
      select: options.includeTagColor
        ? { id: true, name: true, slug: true, color: true }
        : { id: true, name: true, slug: true },
    },
    _count: {
      select: { comments: { where: { deletedAt: null } }, likes: true },
    },
  } satisfies PublicPostSelect
}

export function buildOffsetPagination({ page, limit, total }: { page: number; limit: number; total: number }) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

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
      { excerpt: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      select: getPublicPostSelect(),
      orderBy: PUBLIC_POST_ORDER_BY,
      skip: (page - 1) * limit,
      take: limit,
    }) as unknown as Promise<PublicPostRecord[]>,
    prisma.post.count({ where }),
  ])

  return {
    posts,
    pagination: buildOffsetPagination({ page, limit, total }),
  }
}
