import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/blog-settings', () => ({
  getBlogSettings: () =>
    Promise.resolve({
      siteName: 'Configured Blog',
      siteDescription: 'Configured description',
      siteUrl: 'https://blog.example',
      locale: 'zh-CN',
    }),
}))

describe('robots', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top'
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'
  })

  test('points crawlers to the public sitemap and disallows private surfaces', async () => {
    const { default: robots } = await import('../robots')
    const output = await robots()

    expect(output.sitemap).toBe('https://blog.example/sitemap.xml')
    expect(output.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/profile', '/write'],
    })
  })
})
