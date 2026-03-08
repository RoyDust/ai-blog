import { expect, test } from 'vitest'
import postCatalog from '../../../scripts/mock-post-catalog.json'

test('mock post catalog covers new categories and engineering tags', () => {
  expect(postCatalog.length).toBeGreaterThanOrEqual(8)

  for (const post of postCatalog) {
    expect(typeof post.coverImage).toBe('string')
    expect(post.coverImage.length).toBeGreaterThan(0)
    expect(typeof post.viewCount).toBe('number')
    expect(post.viewCount).toBeGreaterThan(100)
  }

  const categorySlugs = new Set(postCatalog.map((post) => post.categorySlug))
  const tagSlugs = new Set(postCatalog.flatMap((post) => post.tagSlugs))

  for (const slug of [
    'frontend',
    'backend',
    'engineering',
    'performance-optimization',
    'design-system',
    'product-experience',
    'database',
    'deployment-ops',
  ]) {
    expect(categorySlugs.has(slug)).toBe(true)
  }

  for (const slug of [
    'nextjs',
    'react',
    'typescript',
    'prisma',
    'engineering',
    'frontend-architecture',
    'component-design',
    'testing',
    'api-design',
    'database-design',
    'authentication',
    'deployment',
    'ci-cd',
    'observability',
  ]) {
    expect(tagSlugs.has(slug)).toBe(true)
  }
})
