import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { getSiteUrl } from '@/lib/seo'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl()
  const posts = await prisma.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
  })

  const staticRoutes: MetadataRoute.Sitemap = [
    '',
    '/posts',
    '/archives',
    '/categories',
    '/tags',
    '/search',
  ].map((path) => ({
    url: `${siteUrl}${path || '/'}`,
    lastModified: new Date(),
  }))

  const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${siteUrl}/posts/${post.slug}`,
    lastModified: post.updatedAt,
  }))

  return [...staticRoutes, ...postRoutes]
}
