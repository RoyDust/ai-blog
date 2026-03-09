import { describe, expect, test } from 'vitest'
import { buildCanonicalUrl, buildArticleJsonLd } from '../seo'

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
