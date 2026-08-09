import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, test, vi } from 'vitest'
import { HomeLatestPosts } from '../HomeLatestPosts'

vi.mock('next/image', () => ({
  default: (
    props: React.ComponentProps<'img'> & {
      blurDataURL?: string
      fill?: boolean
      placeholder?: string
      priority?: boolean
      quality?: number
    },
  ) => {
    const {
      blurDataURL: _blurDataURL,
      fill: _fill,
      placeholder: _placeholder,
      priority: _priority,
      quality: _quality,
      ...imageProps
    } = props
    void _fill
    void _blurDataURL
    void _placeholder
    void _priority
    void _quality
    return React.createElement('img', { ...imageProps, alt: imageProps.alt ?? '' })
  },
}))

describe('HomeLatestPosts', () => {
  const posts = Array.from({ length: 3 }, (_, index) => ({
    id: `post-${index + 1}`,
    title: `Compact story ${index + 1}`,
    slug: `compact-story-${index + 1}`,
    excerpt: `Summary ${index + 1}`,
    coverImage: `/images/compact-story-${index + 1}.jpg`,
    createdAt: new Date(Date.UTC(2026, 7, 8 - index)),
    readingTimeMinutes: 6 + index,
    viewCount: 41 + index,
    author: { id: `author-${index + 1}`, name: 'Author', image: null },
    category: { id: `category-${index + 1}`, name: `Category ${index + 1}`, slug: `category-${index + 1}` },
    tags: [{ id: `tag-${index + 1}`, name: `Tag ${index + 1}`, slug: `tag-${index + 1}` }],
    _count: { comments: index, likes: index + 1 },
  }))

  test('renders every latest story as a compact item while preserving discovery metadata', () => {
    render(<HomeLatestPosts posts={posts} />)

    const heading = screen.getByRole('heading', { name: '最新文章', level: 2 })
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    expect(section).toHaveAttribute('aria-labelledby', heading.id)

    const articles = within(section!).getAllByRole('article')
    expect(articles).toHaveLength(posts.length)
    expect(within(section!).queryByText('精选文章')).not.toBeInTheDocument()

    articles.forEach((article, index) => {
      const post = posts[index]
      const item = within(article)

      expect(article.className).not.toContain('reader-feature-card')
      expect(item.getByRole('heading', { name: post.title })).toBeInTheDocument()
      expect(item.getByRole('link', { name: post.title })).toHaveAttribute('href', `/posts/${post.slug}`)
      expect(item.getByRole('link', { name: post.category.name })).toHaveAttribute(
        'href',
        `/categories/${post.category.slug}`,
      )
      expect(item.getByText(`${post.readingTimeMinutes} 分钟`)).toBeInTheDocument()
      expect(item.getByText(`${post.viewCount} 浏览`)).toBeInTheDocument()
      expect(item.getByText(/^2026/)).toBeInTheDocument()
      expect(item.queryByRole('link', { name: `继续阅读 ${post.title}` })).not.toBeInTheDocument()
    })
  })
})
