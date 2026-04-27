import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

const originalNextAuthUrl = process.env.NEXTAUTH_URL
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL

beforeAll(() => {
  process.env.NEXTAUTH_URL = 'http://127.0.0.1:3000'
  process.env.NEXT_PUBLIC_SITE_URL = 'http://roydust.top'
})

afterAll(() => {
  process.env.NEXTAUTH_URL = originalNextAuthUrl
  process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl
})

const findFirst = vi.fn()
const findMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findFirst,
      findMany,
    },
  },
}))

findFirst.mockResolvedValue({
  id: 'p1',
  slug: 'test-post',
  title: 'Article Title',
  content: '# Intro\nBody text',
  excerpt: 'Excerpt',
  seoDescription: null,
  coverImage: 'https://example.com/cover.png',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  publishedAt: new Date('2026-01-01T00:00:00Z'),
  viewCount: 100,
  author: { id: 'u1', name: 'Author', image: null },
  category: { name: 'Category', slug: 'category' },
  tags: [{ name: 'Tag', slug: 'tag' }],
  comments: [],
  _count: { comments: 0, likes: 2 },
})

findMany.mockResolvedValue([])

describe('article metadata', () => {
  test('generates article metadata from post content', async () => {
    const { generateMetadata } = await import('@/app/(public)/posts/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test-post' }) })

    expect(metadata.title).toBe('Article Title | My Blog')
    expect(metadata.description).toBe('Excerpt')
    expect(metadata.alternates?.canonical).toBe('http://roydust.top/posts/test-post')
    expect((metadata.openGraph as { type?: string })?.type).toBe('article')
  }, 15_000)
})
