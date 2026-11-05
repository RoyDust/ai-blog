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

  test('renders every latest story as a short-dated list row while preserving discovery metadata', () => {
    render(<HomeLatestPosts posts={[{ ...posts[0], featured: true }, ...posts.slice(1)]} />)

    const heading = screen.getByRole('heading', { name: '最新文章', level: 2 })
    expect(heading).toHaveClass('ed-section-head__title')
    const section = heading.closest('section')
    expect(section).not.toBeNull()
    expect(section).toHaveAttribute('aria-labelledby', heading.id)
    expect(within(section!).getByRole('link', { name: '全部文章' })).toHaveAttribute('href', '/posts')

    const rows = within(section!).getAllByTestId('post-list-row')
    expect(rows).toHaveLength(posts.length)
    // 首页最新不写「精选」标记，也没有旧版精选卡
    expect(within(section!).queryByText('精选')).not.toBeInTheDocument()
    expect(within(section!).queryByText('精选文章')).not.toBeInTheDocument()

    rows.forEach((row, index) => {
      const post = posts[index]
      const item = within(row)

      expect(row).toHaveClass('ed-row')
      expect(row.className).not.toContain('reader-feature-card')
      expect(item.getByRole('heading', { level: 3, name: post.title })).toBeInTheDocument()
      expect(item.getByRole('link', { name: post.title })).toHaveAttribute('href', `/posts/${post.slug}`)
      expect(item.getByRole('link', { name: post.category.name })).toHaveAttribute(
        'href',
        `/categories/${post.category.slug}`,
      )
      expect(item.getByRole('link', { name: `#${post.tags[0].name}` })).toHaveAttribute('href', `/tags/${post.tags[0].slug}`)
      expect(item.getByText(`${post.readingTimeMinutes} 分钟`)).toBeInTheDocument()
      // 浏览量不再出现在列表 meta
      expect(item.queryByText(`${post.viewCount} 浏览`)).not.toBeInTheDocument()
      // 单行「MM-DD」日期列
      const day = String(8 - index).padStart(2, '0')
      expect(row.querySelector('.ed-row__date--desktop time')).toHaveTextContent(new RegExp(`^08-${day}$`))
      expect(row.querySelector('.ed-row__thumb')).not.toBeNull()
      expect(item.queryByRole('link', { name: `继续阅读 ${post.title}` })).not.toBeInTheDocument()
    })
  })

  test('shows a text-only empty state with secondary links when there are no posts', () => {
    render(<HomeLatestPosts posts={[]} />)

    expect(screen.getByRole('heading', { name: '最新文章', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('还没有发布文章，第一篇正在路上。')).toHaveClass('ed-empty__title')
    expect(screen.getByRole('link', { name: '浏览系列' })).toHaveAttribute('href', '/series')
    expect(screen.getByRole('link', { name: '关于作者' })).toHaveAttribute('href', '/about')
    expect(screen.queryByTestId('post-list-row')).not.toBeInTheDocument()
  })
})
