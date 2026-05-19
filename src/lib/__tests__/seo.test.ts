import { afterEach, describe, expect, test } from 'vitest'
import {
  buildArticleMetadata,
  buildArticleJsonLd,
  buildBreadcrumbJsonLd,
  buildCanonicalUrl,
  buildNoIndexMetadata,
  buildPageMetadata,
  buildPersonJsonLd,
  buildWebSiteJsonLd,
  getSiteUrl,
} from '../seo'

const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalSiteUrl = process.env.SITE_URL
const originalPublicSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

afterEach(() => {
  restoreEnv('NEXTAUTH_URL', originalNextAuthUrl)
  restoreEnv('SITE_URL', originalSiteUrl)
  restoreEnv('NEXT_PUBLIC_SITE_URL', originalPublicSiteUrl)
})

function restoreEnv(key: 'NEXTAUTH_URL' | 'SITE_URL' | 'NEXT_PUBLIC_SITE_URL', value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

function clearSiteUrlEnv() {
  delete process.env.NEXTAUTH_URL
  delete process.env.SITE_URL
  delete process.env.NEXT_PUBLIC_SITE_URL
}

describe('seo helpers', () => {
  test('defaults canonical urls to roydust.top', () => {
    clearSiteUrlEnv()

    expect(getSiteUrl()).toBe('http://roydust.top')
    expect(buildCanonicalUrl('/posts/hello-world')).toBe('http://roydust.top/posts/hello-world')
  })

  test('prefers the public site url over auth callback url', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top/'
    process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'

    expect(getSiteUrl()).toBe('http://roydust.top')
    expect(buildCanonicalUrl('posts/hello-world')).toBe('http://roydust.top/posts/hello-world')
  })

  test('builds noindex metadata for utility pages', () => {
    clearSiteUrlEnv()

    const metadata = buildNoIndexMetadata({
      title: '搜索',
      description: '搜索站内文章。',
      path: '/search',
    })

    expect(metadata.alternates?.canonical).toBe('http://roydust.top/search')
    expect(metadata.robots).toEqual({ index: false, follow: true })
  })

  test('builds open graph image metadata with alt text by default', () => {
    const metadata = buildPageMetadata({
      title: '专题页',
      description: '专题描述',
      path: '/categories/frontend',
      image: 'https://example.com/og.png',
      siteUrl: 'https://blog.example',
    })

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://example.com/og.png',
        alt: '专题页',
      },
    ])
    expect(metadata.twitter?.images).toEqual(['https://example.com/og.png'])
  })

  test('uses explicit open graph image dimensions and type when provided', () => {
    const metadata = buildPageMetadata({
      title: '专题页',
      description: '专题描述',
      path: '/categories/frontend',
      image: 'https://blog.example/categories/frontend/opengraph-image',
      imageMetadata: {
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: '前端分类专题',
      },
      siteUrl: 'https://blog.example',
    })

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://blog.example/categories/frontend/opengraph-image',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: '前端分类专题',
      },
    ])
  })

  test('builds article metadata with author open graph field', () => {
    const metadata = buildArticleMetadata({
      title: 'Hello World',
      description: 'Summary',
      path: '/posts/hello-world',
      image: 'https://example.com/cover.png',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-01-02T00:00:00.000Z',
      authorName: 'Author',
      siteUrl: 'https://blog.example',
    })

    expect(metadata.openGraph).toMatchObject({
      type: 'article',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-01-02T00:00:00.000Z',
      authors: ['Author'],
    })
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://example.com/cover.png',
        alt: 'Hello World',
      },
    ])
  })

  test('builds article json-ld payload', () => {
    clearSiteUrlEnv()

    const payload = buildArticleJsonLd({
      title: 'Hello World',
      description: 'Summary',
      path: '/posts/hello-world',
      publishedTime: '2026-01-01T00:00:00.000Z',
      modifiedTime: '2026-01-02T00:00:00.000Z',
      authorName: 'Author',
      image: 'https://example.com/cover.png',
      categoryName: 'Engineering',
      tags: ['Next.js', 'Prisma'],
    })

    expect(payload['@type']).toBe('BlogPosting')
    expect(payload.headline).toBe('Hello World')
    expect(payload.mainEntityOfPage).toBe('http://roydust.top/posts/hello-world')
    expect(payload.url).toBe('http://roydust.top/posts/hello-world')
    expect(payload.publisher).toEqual({
      '@type': 'Organization',
      name: 'My Blog',
      url: 'http://roydust.top',
    })
    expect(payload.articleSection).toBe('Engineering')
    expect(payload.keywords).toBe('Next.js, Prisma')
  })

  test('builds article json-ld with configured site identity', () => {
    const payload = buildArticleJsonLd({
      title: 'Hello World',
      description: 'Summary',
      path: '/posts/hello-world',
      publishedTime: '2026-01-01T00:00:00.000Z',
      authorName: 'Author',
      siteName: 'Configured Blog',
      siteUrl: 'https://blog.example',
    })

    expect(payload.url).toBe('https://blog.example/posts/hello-world')
    expect(payload.publisher).toEqual({
      '@type': 'Organization',
      name: 'Configured Blog',
      url: 'https://blog.example',
    })
  })

  test('builds breadcrumb json-ld payload', () => {
    clearSiteUrlEnv()

    const payload = buildBreadcrumbJsonLd([
      { name: '首页', path: '/' },
      { name: '文章', path: '/posts' },
      { name: 'Hello World', path: '/posts/hello-world' },
    ])

    expect(payload['@type']).toBe('BreadcrumbList')
    expect(payload.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: '首页', item: 'http://roydust.top/' },
      { '@type': 'ListItem', position: 2, name: '文章', item: 'http://roydust.top/posts' },
      { '@type': 'ListItem', position: 3, name: 'Hello World', item: 'http://roydust.top/posts/hello-world' },
    ])
  })

  test('builds website json-ld with search action', () => {
    const payload = buildWebSiteJsonLd({
      siteName: 'Configured Blog',
      siteUrl: 'https://blog.example',
      searchPath: '/search',
    })

    expect(payload).toEqual({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Configured Blog',
      url: 'https://blog.example',
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: 'https://blog.example/search?q={search_term_string}',
        },
        'query-input': 'required name=search_term_string',
      },
    })
  })

  test('builds person json-ld payload', () => {
    const payload = buildPersonJsonLd({
      name: 'Roy',
      url: 'https://blog.example/about',
      image: 'https://example.com/avatar.png',
      description: 'Author bio',
      sameAs: ['https://github.com/RoyDust'],
    })

    expect(payload).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Roy',
      url: 'https://blog.example/about',
      image: 'https://example.com/avatar.png',
      description: 'Author bio',
      sameAs: ['https://github.com/RoyDust'],
    })
  })
})
