import { describe, expect, test } from 'vitest'
import { filterPosts } from '../posts-filter'

const posts = [
  {
    id: '1',
    title: 'Next.js ISR Guide',
    excerpt: 'Static regeneration patterns',
    category: { slug: 'frontend', name: 'Frontend' },
    tags: [{ slug: 'nextjs', name: 'Next.js' }],
  },
  {
    id: '2',
    title: 'Prisma Tips',
    excerpt: 'Database workflow',
    category: { slug: 'backend', name: 'Backend' },
    tags: [{ slug: 'prisma', name: 'Prisma' }],
  },
] as const

describe('filterPosts', () => {
  test('filters by search keyword', () => {
    expect(filterPosts(posts, { search: 'isr', category: '', tag: '' })).toEqual([posts[0]])
  })

  test('filters by category and tag together', () => {
    expect(filterPosts(posts, { search: '', category: 'backend', tag: 'prisma' })).toEqual([posts[1]])
  })

  test('returns all posts when filters are empty', () => {
    expect(filterPosts(posts, { search: '', category: '', tag: '' })).toEqual(posts)
  })
})
