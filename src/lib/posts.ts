/**
 * 前台文章查询仓库。
 *
 * 职责：
 * - 定义公共文章卡片所需的统一 select 结构
 * - 提供精选文章与分页文章列表查询
 * - 统一前台列表页的排序与 offset 分页格式
 */
import { createPublicCachedReader, PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from '@/lib/cache'
import { prisma } from '@/lib/prisma'

type PostFindManyArgs = NonNullable<Parameters<typeof prisma.post.findMany>[0]>
type PublicPostSelect = NonNullable<PostFindManyArgs['select']>
type PublicPostOrderBy = Exclude<PostFindManyArgs['orderBy'], undefined>

export interface PublicPostRecord {
  id: string
  title: string
  slug: string
  generatedByAiNews: boolean
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

type RawPublicPostCategory = {
  id: string
  name: string
  slug: string
  deletedAt?: Date | string | null
}

export function rehydratePublicPostRecord(post: PublicPostRecord): PublicPostRecord {
  const rawCategory = post.category as RawPublicPostCategory | null | undefined
  const activeCategory =
    rawCategory && !rawCategory.deletedAt
      ? {
          id: rawCategory.id,
          name: rawCategory.name,
          slug: rawCategory.slug,
        }
      : null
  const createdAt =
    typeof (post as { createdAt?: unknown }).createdAt === 'string'
      ? new Date(post.createdAt)
      : post.createdAt
  const categoryUnchanged =
    activeCategory === null
      ? post.category === null
      : post.category !== null &&
        !('deletedAt' in (rawCategory ?? {})) &&
        post.category.id === activeCategory.id &&
        post.category.name === activeCategory.name &&
        post.category.slug === activeCategory.slug

  if (createdAt === post.createdAt && categoryUnchanged) {
    return post
  }

  return {
    ...post,
    createdAt,
    category: activeCategory,
  }
}

/**
 * 返回前台文章卡片使用的 Prisma select。
 * 统一 select 结构可以减少各页面各写一套字段，避免列表数据形状漂移。
 */
export function getPublicPostSelect(options: { includeTagColor?: boolean } = {}): PublicPostSelect {
  return {
    id: true,
    title: true,
    slug: true,
    generatedByAiNews: true,
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
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
    },
    tags: {
      where: { deletedAt: null },
      select: options.includeTagColor
        ? { id: true, name: true, slug: true, color: true }
        : { id: true, name: true, slug: true },
    },
    _count: {
      select: { comments: { where: { deletedAt: null, status: 'APPROVED' } }, likes: true },
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

export type PublicPostContentType = 'all' | 'original' | 'ai-daily'

interface PublishedPostsPageInput {
  page: number
  limit: number
  category?: string | null
  tag?: string | null
  search?: string | null
  type?: PublicPostContentType | null
}

const getCachedFeaturedPosts = createPublicCachedReader(
  async (limit: number) => {
    const posts = (await prisma.post.findMany({
      where: { published: true, featured: true, deletedAt: null },
      select: getPublicPostSelect(),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    })) as unknown as PublicPostRecord[]
    return posts.map(rehydratePublicPostRecord)
  },
  {
    keyParts: ['public-featured-posts'],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.tags],
    rehydrate: (posts) => posts.map(rehydratePublicPostRecord),
  },
)

/**
 * 获取首页 / 专题区使用的精选文章列表。
 */
export async function getFeaturedPosts(limit = 3) {
  return getCachedFeaturedPosts(limit)
}

const getCachedHomeLatestPosts = createPublicCachedReader(
  async (limit: number) => {
    const posts = (await prisma.post.findMany({
      where: { published: true, deletedAt: null },
      select: getPublicPostSelect(),
      orderBy: [
        { generatedByAiNews: 'asc' },
        { featured: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
    })) as unknown as PublicPostRecord[]
    return posts.map(rehydratePublicPostRecord)
  },
  {
    keyParts: ['public-home-latest-posts'],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.tags],
    rehydrate: (posts) => posts.map(rehydratePublicPostRecord),
  },
)

/**
 * 获取首页最新文章，优先展示人工文章；数量不足时再用 AI 日报文章补足。
 */
export async function getHomeLatestPosts(limit: number) {
  return getCachedHomeLatestPosts(limit)
}

async function queryPublishedPostsPage({
  page,
  limit,
  category,
  tag,
  search,
  type,
}: {
  page: number
  limit: number
  category: string | null
  tag: string | null
  search: string | null
  type: 'original' | 'ai-daily' | null
}) {
  const where: NonNullable<Parameters<typeof prisma.post.findMany>[0]>['where'] = {
    published: true,
    deletedAt: null,
  }

  if (type === 'original') {
    where.generatedByAiNews = false
  } else if (type === 'ai-daily') {
    where.generatedByAiNews = true
  }

  if (category) {
    where.category = { slug: category, deletedAt: null }
  }

  if (tag) {
    const activeTag = await prisma.tag.findFirst({
      where: { slug: tag, deletedAt: null },
      select: { id: true },
    })
    if (!activeTag) {
      return { posts: [] as PublicPostRecord[], pagination: buildOffsetPagination({ page, limit, total: 0 }) }
    }
    where.tags = { some: { id: activeTag.id, deletedAt: null } }
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
    posts: posts.map(rehydratePublicPostRecord),
    pagination: buildOffsetPagination({ page, limit, total }),
  }
}

const getCachedPublishedPostsPage = createPublicCachedReader(queryPublishedPostsPage, {
  keyParts: ['public-published-posts-page'],
  revalidate: PUBLIC_REVALIDATE_SECONDS,
  tags: [PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.tags],
  rehydrate: (result) => ({
    ...result,
    posts: result.posts.map(rehydratePublicPostRecord),
  }),
})

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
  type,
}: PublishedPostsPageInput) {
  const normalizedCategory = category?.trim() || null
  const normalizedTag = tag?.trim() || null
  const normalizedSearch = search?.trim() || null
  const normalizedType = type === 'original' || type === 'ai-daily' ? type : null

  return getCachedPublishedPostsPage({
    page,
    limit,
    category: normalizedCategory,
    tag: normalizedTag,
    search: normalizedSearch,
    type: normalizedType,
  })
}
