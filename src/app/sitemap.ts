import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo'

async function getSitemapPosts() {
  return prisma.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  })
}

type SitemapPost = Awaited<ReturnType<typeof getSitemapPosts>>[number]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/posts',
    '/archives',
    '/categories',
    '/tags',
    '/search',
  ].map((path: string) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: new Date(),
  }))

  try {
    const posts = await getSitemapPosts()

    const postRoutes: MetadataRoute.Sitemap = posts.map((post: SitemapPost) => ({
      url: `${siteUrl}/posts/${post.slug}`,
      lastModified: post.updatedAt,
    }))

    return [...staticRoutes, ...postRoutes]
  } catch (error) {
    console.error('Generate sitemap error:', error)
    return staticRoutes
  }
}
