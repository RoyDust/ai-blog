/**
 * 前台文章查询仓库。
 *
 * 职责：
 * - 定义公共文章卡片所需的统一 select 结构
 * - 提供精选文章与分页文章列表查询
 * - 统一前台列表页的排序与 offset 分页格式
 */
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
  featured: boolean
  createdAt: Date
  readingTimeMinutes: number
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

export const PUBLIC_POST_ORDER_BY: PublicPostOrderBy = [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]

/**
 * 返回前台文章卡片使用的 Prisma select。
 * 统一 select 结构可以减少各页面各写一套字段，避免列表数据形状漂移。
 */
export function getPublicPostSelect(options: { includeTagColor?: boolean } = {}): PublicPostSelect {
  return {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    coverImage: true,
    featured: true,
    createdAt: true,
    readingTimeMinutes: true,
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

/**
 * 构造标准 offset 分页信息。
 */
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

/**
 * 获取首页 / 专题区使用的精选文章列表。
 */
export async function getFeaturedPosts(limit = 3) {
  return prisma.post.findMany({
    where: { published: true, featured: true, deletedAt: null },
    select: getPublicPostSelect(),
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  }) as unknown as Promise<PublicPostRecord[]>
}

/**
 * 获取已发布文章分页结果。
 * 支持按分类、标签和关键字过滤，供首页、归档页与搜索页复用。
 */
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
