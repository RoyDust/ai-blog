import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'My Blog',
    short_name: 'My Blog',
    description: '一个基于 Next.js 构建的现代化博客系统。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#111827',
  }
}
