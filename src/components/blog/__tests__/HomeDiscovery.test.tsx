import { render, screen, waitFor, within } from '@testing-library/react'
import React from 'react'
import { SWRConfig } from 'swr'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { HomeDiscovery } from '../HomeDiscovery'

type FetchPayloads = Partial<Record<'/api/categories' | '/api/tags' | '/api/posts/popular', unknown[]>>

function stubDirectoryFetch(payloads: FetchPayloads) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input) as keyof FetchPayloads
    return {
      ok: true,
      json: async () => ({ success: true, data: payloads[url] ?? [] }),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderDiscovery() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <HomeDiscovery />
    </SWRConfig>,
  )
}

const categories = Array.from({ length: 7 }, (_, index) => ({
  id: `c${index + 1}`,
  name: `Category ${index + 1}`,
  slug: `category-${index + 1}`,
  _count: { posts: 10 - index },
}))

const popularPosts = Array.from({ length: 4 }, (_, index) => ({
  id: `p${index + 1}`,
  title: `Popular ${index + 1}`,
  slug: `popular-${index + 1}`,
  viewCount: 100 - index,
}))

describe('HomeDiscovery', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('renders six dotted category rows, top three popular posts and an all-tags link from the shared SWR keys', async () => {
    const fetchMock = stubDirectoryFetch({ '/api/categories': categories, '/api/posts/popular': popularPosts })

    renderDiscovery()

    const section = await screen.findByTestId('home-discovery')
    // 只在 xl 以下出现（xl 起侧栏可见）
    expect(section).toHaveClass('xl:hidden')
    expect(screen.getByRole('heading', { level: 2, name: '发现' })).toHaveClass('ed-section-head__title')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Category 1/ })).toBeInTheDocument()
    })

    const categoryLinks = screen.getAllByRole('link', { name: /^Category \d/ })
    expect(categoryLinks).toHaveLength(6)
    expect(categoryLinks[0]).toHaveClass('ed-dotted-row')
    expect(categoryLinks[0]).toHaveAttribute('href', '/categories/category-1')
    expect(within(categoryLinks[0]).getByText('10')).toHaveClass('ed-dotted-row__count')
    expect(screen.queryByRole('link', { name: /Category 7/ })).not.toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Popular 1/ })).toBeInTheDocument()
    })
    const popularList = screen.getByRole('heading', { level: 3, name: '热门' }).nextElementSibling as HTMLElement
    const popularLinks = within(popularList).getAllByRole('link')
    expect(popularLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/posts/popular-1',
      '/posts/popular-2',
      '/posts/popular-3',
    ])
    expect(within(popularLinks[0]).getByText('01')).toHaveClass('ed-mono')

    expect(screen.getByRole('link', { name: '全部标签' })).toHaveAttribute('href', '/tags')

    const requested = fetchMock.mock.calls.map(([url]) => String(url))
    expect(requested).toEqual(expect.arrayContaining(['/api/categories', '/api/tags', '/api/posts/popular']))
  })

  test('omits the popular column when there are no popular posts', async () => {
    stubDirectoryFetch({ '/api/categories': categories.slice(0, 2) })

    renderDiscovery()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Category 1/ })).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { level: 3, name: '热门' })).not.toBeInTheDocument()
  })

  test('is hidden once loading finishes with no categories and no popular posts', async () => {
    const fetchMock = stubDirectoryFetch({})

    const { container } = renderDiscovery()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
    expect(screen.queryByTestId('home-discovery')).not.toBeInTheDocument()
  })
})
