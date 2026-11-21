import type { MetadataRoute } from 'next'
import { getBlogSettings } from '@/lib/blog-settings'
import { getSiteUrl } from '@/lib/seo'

// 站点地图对分钟级新鲜度没有需求：按小时 ISR，避免每次爬虫访问都跑多条 findMany
export const revalidate = 3600

async function getPrisma() {
  const { prisma } = await import('@/lib/prisma')

  return prisma
}

type SitemapPrisma = Awaited<ReturnType<typeof getPrisma>>

async function getSitemapPosts(prisma: SitemapPrisma) {
  return prisma.post.findMany({
    where: { published: true, deletedAt: null },
    select: { slug: true, updatedAt: true, featured: true },
    orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
  })
}

async function getSitemapCategories(prisma: SitemapPrisma) {
  return prisma.category.findMany({
    where: { deletedAt: null },
    select: {
      slug: true,
      createdAt: true,
      posts: {
        where: { published: true, deletedAt: null },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

async function getSitemapTags(prisma: SitemapPrisma) {
  return prisma.tag.findMany({
    where: { deletedAt: null },
    select: {
      slug: true,
      createdAt: true,
      posts: {
        where: { published: true, deletedAt: null },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
    orderBy: [{ posts: { _count: 'desc' } }, { name: 'asc' }],
  })
}

async function getSitemapSeries(prisma: SitemapPrisma) {
  return prisma.series.findMany({
    where: {
      deletedAt: null,
      posts: { some: { published: true, deletedAt: null } },
    },
    select: {
      slug: true,
      updatedAt: true,
      createdAt: true,
      posts: {
        where: { published: true, deletedAt: null },
        select: { updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      },
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
  })
}

function isMissingTopicGuideStorageError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const code = 'code' in error && typeof error.code === 'string' ? error.code : ''
  const message = 'message' in error && typeof error.message === 'string' ? error.message : ''

  return (
    code === '42P01' ||
    code === 'P2021' ||
    message.includes('relation "topic_guides" does not exist') ||
    message.includes('The table `public.topic_guides` does not exist')
  )
}

async function getSitemapTopicGuides(prisma: SitemapPrisma) {
  if (!prisma.topicGuide?.findMany) {
    return []
  }

  try {
    return await prisma.topicGuide.findMany({
      where: {
        status: 'published',
        deletedAt: null,
      },
      select: {
        slug: true,
        updatedAt: true,
        createdAt: true,
        posts: {
          where: { post: { published: true, deletedAt: null } },
          select: {
            post: {
              select: { updatedAt: true },
            },
          },
          orderBy: { post: { updatedAt: 'desc' } },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    })
  } catch (error) {
    if (isMissingTopicGuideStorageError(error)) {
      return []
    }

    throw error
  }
}

type SitemapPost = Awaited<ReturnType<typeof getSitemapPosts>>[number]
type SitemapCategory = Awaited<ReturnType<typeof getSitemapCategories>>[number]
type SitemapTag = Awaited<ReturnType<typeof getSitemapTags>>[number]
type SitemapSeries = Awaited<ReturnType<typeof getSitemapSeries>>[number]
type SitemapTopicGuide = Awaited<ReturnType<typeof getSitemapTopicGuides>>[number]

function getStaticRoutes(siteUrl: string): MetadataRoute.Sitemap {
  return [
    '',
    '/posts',
    '/archives',
    '/categories',
    '/tags',
    '/series',
    '/guides',
  ].map((path: string) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }))
}

export async function buildSitemap(prisma: SitemapPrisma, siteUrl = getSiteUrl()): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = getStaticRoutes(siteUrl)
  const [posts, categories, tags, series, guides] = await Promise.all([
    getSitemapPosts(prisma),
    getSitemapCategories(prisma),
    getSitemapTags(prisma),
    getSitemapSeries(prisma),
    getSitemapTopicGuides(prisma),
  ])

  const postRoutes: MetadataRoute.Sitemap = posts.map((post: SitemapPost) => ({
    url: `${siteUrl}/posts/${post.slug}`,
    lastModified: post.updatedAt,
    changeFrequency: post.featured ? 'weekly' : 'monthly',
    priority: post.featured ? 0.9 : 0.7,
  }))

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((category: SitemapCategory) => category._count.posts > 0)
    .map((category: SitemapCategory) => ({
      url: `${siteUrl}/categories/${category.slug}`,
      lastModified: category.posts[0]?.updatedAt || category.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  const tagRoutes: MetadataRoute.Sitemap = tags
    .filter((tag: SitemapTag) => tag._count.posts > 0)
    .map((tag: SitemapTag) => ({
      url: `${siteUrl}/tags/${tag.slug}`,
      lastModified: tag.posts[0]?.updatedAt || tag.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    }))

  const seriesRoutes: MetadataRoute.Sitemap = series
    .filter((item: SitemapSeries) => item._count.posts > 0)
    .map((item: SitemapSeries) => ({
      url: `${siteUrl}/series/${item.slug}`,
      lastModified: item.posts[0]?.updatedAt || item.updatedAt || item.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  const guideRoutes: MetadataRoute.Sitemap = guides.map((guide: SitemapTopicGuide) => {
    const latestPostUpdatedAt = guide.posts?.[0]?.post?.updatedAt
    const guideUpdatedAt = guide.updatedAt || guide.createdAt
    const lastModified =
      latestPostUpdatedAt && guideUpdatedAt && latestPostUpdatedAt > guideUpdatedAt
        ? latestPostUpdatedAt
        : latestPostUpdatedAt || guideUpdatedAt

    return {
      url: `${siteUrl}/guides/${guide.slug}`,
      lastModified,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }
  })

  return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes, ...seriesRoutes, ...guideRoutes]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { siteUrl } = await getBlogSettings()

  try {
    return await buildSitemap(await getPrisma(), siteUrl)
  } catch (error) {
    console.error('Generate sitemap error:', error)
    return getStaticRoutes(siteUrl)
  }
}
