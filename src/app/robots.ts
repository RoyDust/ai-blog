import type { MetadataRoute } from 'next'
import { getBlogSettings } from '@/lib/blog-settings'

export const dynamic = "force-dynamic"

export default async function robots(): Promise<MetadataRoute.Robots> {
  const { siteUrl } = await getBlogSettings()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api',
        '/profile',
        '/write',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  }
}
