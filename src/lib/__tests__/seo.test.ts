import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { buildCanonicalUrl, buildArticleJsonLd } from '../seo'

const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

beforeAll(() => {
  process.env.NEXTAUTH_URL = 'http://47.98.167.32'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://47.98.167.32'
})

afterAll(() => {
  process.env.NEXTAUTH_URL = originalNextAuthUrl
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
})

describe('seo helpers', () => {
  test('builds canonical url from path', () => {
    expect(buildCanonicalUrl('/posts/hello-world')).toBe('http://47.98.167.32/posts/hello-world')
  })

  test('builds article json-ld payload', () => {
    const payload = buildArticleJsonLd({
      title: 'Hello World',
      description: 'Summary',
      path: '/posts/hello-world',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-01-02T00:00:00.000Z',
      authorName: 'Author',
      image: 'https://example.com/cover.png',
    })

    expect(payload['@type']).toBe('BlogPosting')
    expect(payload.headline).toBe('Hello World')
    expect(payload.mainEntityOfPage).toBe('http://47.98.167.32/posts/hello-world')
  })
})
