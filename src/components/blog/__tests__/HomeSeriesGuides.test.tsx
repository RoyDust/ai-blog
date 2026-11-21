import { render, screen, within } from '@testing-library/react'
import React from 'react'
import { describe, expect, test } from 'vitest'
import { HomeSeriesGuides, type HomeGuideItem, type HomeSeriesItem } from '../HomeSeriesGuides'

const series: HomeSeriesItem[] = [
  { id: 's1', title: 'AI 日报', slug: 'ai-daily', postCount: 120, latestPostTitle: '今日要闻', isDaily: true },
  { id: 's2', title: 'Next.js 实战', slug: 'nextjs', postCount: 8, latestPostTitle: '缓存与重验证' },
  { id: 's3', title: 'Prisma 笔记', slug: 'prisma', postCount: 5, latestPostTitle: null },
  { id: 's4', title: '第四个系列', slug: 'fourth', postCount: 2 },
]

const guides: HomeGuideItem[] = [
  { id: 'g1', title: 'RAG 入门', slug: 'rag', description: '从检索到生成' },
  { id: 'g2', title: 'Agent 设计', slug: 'agent', description: null },
  { id: 'g3', title: '第三个专题', slug: 'third' },
]

describe('HomeSeriesGuides', () => {
  test('renders up to three series rows and two guide rows with serif titles and text links', () => {
    render(<HomeSeriesGuides guides={guides} series={series} />)

    const heading = screen.getByRole('heading', { level: 2, name: '系列与专题' })
    expect(heading.closest('section')).toHaveAttribute('aria-labelledby', 'home-series-guides-title')

    const seriesList = screen.getByRole('heading', { level: 3, name: '系列' }).nextElementSibling as HTMLElement
    const seriesLinks = within(seriesList).getAllByRole('link')
    expect(seriesLinks.map((link) => link.getAttribute('href'))).toEqual(['/series/ai-daily', '/series/nextjs', '/series/prisma'])
    expect(screen.queryByText('第四个系列')).not.toBeInTheDocument()

    // 每日系列写「每天一篇」，其余写等宽篇数
    expect(within(seriesLinks[0]).getByText('每天一篇')).toBeInTheDocument()
    expect(within(seriesLinks[0]).queryByText('120 篇')).not.toBeInTheDocument()
    expect(within(seriesLinks[1]).getByText('8 篇')).toHaveClass('ed-mono')
    expect(within(seriesLinks[1]).getByText('Next.js 实战')).toHaveClass('ed-serif')
    expect(within(seriesLinks[1]).getByText('最新：缓存与重验证')).toBeInTheDocument()
    expect(within(seriesLinks[2]).queryByText(/^最新：/)).not.toBeInTheDocument()

    const guideList = screen.getByRole('heading', { level: 3, name: '专题指南' }).nextElementSibling as HTMLElement
    const guideLinks = within(guideList).getAllByRole('link')
    expect(guideLinks.map((link) => link.getAttribute('href'))).toEqual(['/guides/rag', '/guides/agent'])
    expect(within(guideLinks[0]).getByText('从检索到生成')).toBeInTheDocument()
    expect(screen.queryByText('第三个专题')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: '全部系列' })).toHaveAttribute('href', '/series')
    expect(screen.getByRole('link', { name: '全部指南' })).toHaveAttribute('href', '/guides')
    expect(screen.getByRole('link', { name: '全部系列' })).toHaveClass('ed-link')
  })

  test('renders only the column that has content', () => {
    render(<HomeSeriesGuides guides={[]} series={series.slice(1, 2)} />)

    expect(screen.getByRole('heading', { level: 3, name: '系列' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 3, name: '专题指南' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '全部指南' })).not.toBeInTheDocument()
  })

  test('renders nothing without series or guides', () => {
    const { container } = render(<HomeSeriesGuides guides={[]} series={[]} />)

    expect(container).toBeEmptyDOMElement()
  })
})
