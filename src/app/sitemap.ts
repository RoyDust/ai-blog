import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo'

async function getSitemapPosts() {
  return prisma.post.findMany({
    where: { published: true, deletedAt: null },
    select: { slug: true, updatedAt: true, featured: true },
    orderBy: [{ featured: 'desc' }, { updatedAt: 'desc' }],
  })
}

async function getSitemapCategories() {
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

async function getSitemapTags() {
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

type SitemapPost = Awaited<ReturnType<typeof getSitemapPosts>>[number]
type SitemapCategory = Awaited<ReturnType<typeof getSitemapCategories>>[number]
type SitemapTag = Awaited<ReturnType<typeof getSitemapTags>>[number]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/posts',
    '/archives',
    '/categories',
    '/tags',
  ].map((path: string) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.8,
  }))

  try {
    const [posts, categories, tags] = await Promise.all([
      getSitemapPosts(),
      getSitemapCategories(),
      getSitemapTags(),
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

    return [...staticRoutes, ...postRoutes, ...categoryRoutes, ...tagRoutes]
  } catch (error) {
    console.error('Generate sitemap error:', error)
    return staticRoutes
  }
}
