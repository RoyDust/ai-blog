import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, test } from 'vitest'
import { HomeAiDailyStrip } from '../HomeAiDailyStrip'

function buildDailyPosts(count: number, firstDay = 7) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(firstDay - index).padStart(2, '0')
    // 02:54 UTC = 10:54 Asia/Shanghai，同一天
    const date = new Date(Date.UTC(2026, 7, firstDay - index, 2, 54))
    return {
      id: `daily-${index + 1}`,
      title: `2026-08-${day} AI 日报：Daily story ${index + 1}`,
      slug: `ai-daily-2026-08-${day}`,
      excerpt: `Daily excerpt ${index + 1}`,
      createdAt: date,
      publishedAt: date,
    }
  })
}

describe('HomeAiDailyStrip', () => {
  test('leads with today\'s issue marked 今日 and lists up to four earlier issues with month-day dates', () => {
    const posts = buildDailyPosts(6)

    render(<HomeAiDailyStrip now={new Date(Date.UTC(2026, 7, 7, 8))} posts={posts} />)

    const heading = screen.getByRole('heading', { level: 2, name: 'AI 日报' })
    expect(heading).toHaveClass('ed-section-head__title')
    const section = heading.closest('section')
    expect(section).toHaveAttribute('aria-labelledby', 'home-ai-daily-title')
    expect(screen.getByRole('link', { name: '全部日报' })).toHaveAttribute('href', '/series/ai-daily')
    // 旧版「查看全部」入口已改为「全部日报 →」
    expect(screen.queryByRole('link', { name: '查看全部' })).not.toBeInTheDocument()

    // 左栏：今日一期
    const lead = screen.getByRole('article')
    expect(within(lead).getByText('今日')).toHaveClass('text-[var(--accent-sky)]')
    expect(within(lead).getByText('2026-08-07')).toHaveAttribute('datetime', '2026-08-07')
    expect(within(lead).getByRole('heading', { level: 3, name: posts[0].title })).toBeInTheDocument()
    expect(within(lead).getByRole('link', { name: posts[0].title })).toHaveAttribute('href', `/posts/${posts[0].slug}`)
    expect(within(lead).getByText('Daily excerpt 1')).toHaveClass('line-clamp-3')
    expect(within(lead).getByRole('link', { name: '阅读今日日报' })).toHaveAttribute('href', `/posts/${posts[0].slug}`)
    expect(screen.queryByText('今日日报生成中')).not.toBeInTheDocument()

    // 右栏：往期 4 行，纵向列表（不再是手机横向 snap 列表）
    const list = screen.getByRole('list', { name: 'AI 日报列表' })
    expect(list.tagName).toBe('OL')
    expect(list.className).not.toContain('overflow-x-auto')
    expect(list.className).not.toContain('snap-x')

    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    expect(items.some((item) => item.className.includes('snap-start'))).toBe(false)

    posts.slice(1, 5).forEach((post) => {
      const link = within(list).getByRole('link', { name: new RegExp(post.title) })
      expect(link).toHaveAttribute('href', `/posts/${post.slug}`)
      expect(link).not.toHaveAttribute('tabindex', '-1')
    })
    expect(within(list).queryByText(posts[5].title)).not.toBeInTheDocument()

    expect(within(list).getAllByText(/^\d{2}-\d{2}$/)).toHaveLength(4)
    expect(within(list).getByText('08-06')).toHaveAttribute('datetime', '2026-08-06')
    expect(within(list).queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument()
  })

  test('shows 今日日报生成中 when today\'s issue is not published yet and keeps every recent issue in the archive', () => {
    const posts = buildDailyPosts(3, 6)

    render(<HomeAiDailyStrip now={new Date(Date.UTC(2026, 7, 7, 8))} posts={posts} />)

    expect(screen.getByText('今日日报生成中')).toBeInTheDocument()
    expect(screen.getByText('今日')).toBeInTheDocument()
    expect(screen.getByText('2026-08-07')).toHaveAttribute('datetime', '2026-08-07')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '阅读今日日报' })).not.toBeInTheDocument()

    const list = screen.getByRole('list', { name: 'AI 日报列表' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
    expect(within(list).getByRole('link', { name: new RegExp(posts[0].title) })).toHaveAttribute('href', `/posts/${posts[0].slug}`)
  })

  test('uses the Asia/Shanghai calendar day to decide whether the latest issue is today', () => {
    // 2026-08-06 18:00 UTC 已是上海 2026-08-07 02:00
    const posts = [{ ...buildDailyPosts(1)[0], publishedAt: new Date(Date.UTC(2026, 7, 6, 18)) }]

    render(<HomeAiDailyStrip now={new Date(Date.UTC(2026, 7, 7, 1))} posts={posts} />)

    expect(screen.getByRole('article')).toBeInTheDocument()
    expect(screen.queryByText('今日日报生成中')).not.toBeInTheDocument()
    // 只有今日一期时不渲染空的往期列表
    expect(screen.queryByRole('list', { name: 'AI 日报列表' })).not.toBeInTheDocument()
  })

  test('does not render an empty landmark', () => {
    const { container } = render(<HomeAiDailyStrip posts={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
