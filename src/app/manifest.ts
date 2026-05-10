import type { MetadataRoute } from 'next'
import { getBlogSettings } from '@/lib/blog-settings'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getBlogSettings()

  return {
    name: settings.siteName,
    short_name: settings.siteName,
    description: settings.siteDescription,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
