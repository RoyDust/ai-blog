import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, test } from 'vitest'
import { HomeAiDailyStrip } from '../HomeAiDailyStrip'

describe('HomeAiDailyStrip', () => {
  test('renders one accessible, keyboard-reachable mobile snap list with calendar dates', () => {
    const posts = Array.from({ length: 5 }, (_, index) => ({
      id: `daily-${index + 1}`,
      title: `2026-08-${String(7 - index).padStart(2, '0')} AI 日报：Daily story ${index + 1}`,
      slug: `ai-daily-2026-08-${String(7 - index).padStart(2, '0')}`,
      excerpt: `Daily excerpt ${index + 1}`,
      createdAt: new Date(Date.UTC(2026, 7, 7 - index, 2, 54)),
      publishedAt: new Date(Date.UTC(2026, 7, 7 - index, 2, 54)),
    }))

    render(<HomeAiDailyStrip posts={posts} />)

    const list = screen.getByRole('list', { name: 'AI 日报列表' })
    expect(list.tagName).toBe('OL')
    expect(list.className).toContain('overflow-x-auto')
    expect(list.className).toContain('snap-x')

    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(5)
    expect(items.every((item) => item.className.includes('snap-start'))).toBe(true)

    const dailyLinks = posts.map((_, index) =>
      within(list).getByRole('link', { name: new RegExp(`Daily story ${index + 1}`) }),
    )
    dailyLinks.forEach((link, index) => {
      expect(link).toHaveAttribute('href', `/posts/${posts[index].slug}`)
      expect(link).not.toHaveAttribute('tabindex', '-1')
    })

    expect(within(list).getAllByText(/^\d{2}\/\d{2}$/)).toHaveLength(5)
    expect(within(list).queryByText(/^\d{2}:\d{2}$/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: '查看全部' })).toHaveLength(1)
  })

  test('does not render an empty landmark', () => {
    const { container } = render(<HomeAiDailyStrip posts={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
