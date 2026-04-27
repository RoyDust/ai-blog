import { beforeEach, describe, expect, test } from 'vitest'

describe('robots', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top'
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'
  })

  test('points crawlers to the public sitemap and disallows private surfaces', async () => {
    const { default: robots } = await import('../robots')
    const output = robots()

    expect(output.sitemap).toBe('http://roydust.top/sitemap.xml')
    expect(output.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api', '/profile', '/write'],
    })
  })
})
