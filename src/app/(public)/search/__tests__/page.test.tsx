import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, expect, test, vi } from 'vitest'
import { SWRConfig, mutate as clearSwrCache } from 'swr'
import SearchPage from '../page'

const routeState = vi.hoisted(() => ({ search: 'q=搜索' }))

function renderSearchPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SearchPage />
    </SWRConfig>,
  )
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(routeState.search),
}))

const post = {
  id: 'post-1',
  title: 'React 搜索体验优化',
  slug: 'react-search-experience',
  excerpt: null,
  content: '搜索结果页面应该保留正文片段，帮助用户快速判断是否相关。',
  coverImage: null,
  createdAt: '2026-03-08T00:00:00.000Z',
  author: { id: 'user-1', name: 'Ada', image: null },
  category: { name: '前端', slug: 'frontend' },
  tags: [{ name: 'React', slug: 'react' }],
  _count: { comments: 2, likes: 4 },
}

function stubMatchMedia() {
  // restoreAllMocks 会清掉 setup 里 matchMedia 的实现；motion 的 useReducedMotion 依赖它
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

beforeEach(async () => {
  routeState.search = 'q=搜索'
  vi.restoreAllMocks()
  stubMatchMedia()
  await clearSwrCache(() => true, undefined, { revalidate: false })
})

test('search page preserves search result content snippet without requesting AI automatically', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: [post],
    }),
  } as Response)

  const { container } = renderSearchPage()

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=%E6%90%9C%E7%B4%A2')
    expect(screen.getByText('正文片段')).toBeInTheDocument()
    expect(container).toHaveTextContent('搜索结果页面应该保留正文片段，帮助用户快速判断是否相关。')
  })
  // 结果数移到区块标题的等宽计数里，结果改用全站列表行
  expect(screen.getByRole('heading', { name: '结果 1' })).toBeInTheDocument()
  expect(container.querySelectorAll('.ed-row')).toHaveLength(1)
  expect(container.querySelector('mark')).toHaveTextContent('搜索')
  expect(screen.queryByText(/找到 1 条结果/)).not.toBeInTheDocument()
  expect(fetchMock).not.toHaveBeenCalledWith('/api/search?q=%E6%90%9C%E7%B4%A2&ai=1')
})

test('search page requests AI summary only after the explicit button is clicked', async () => {
  const fetchMock = vi
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [post],
      }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        ai: { summary: 'AI 建议先看搜索体验优化，再看实现细节。' },
        data: [{ ...post, excerpt: '统一搜索入口与排序' }],
      }),
    } as Response)

  renderSearchPage()

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeEnabled()
  })

  fireEvent.click(screen.getByRole('button', { name: 'AI 搜索摘要' }))

  await waitFor(() => {
    expect(screen.getByRole('button', { name: '生成中' })).toBeDisabled()
  })

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/search?q=%E6%90%9C%E7%B4%A2&ai=1',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    )
    expect(screen.getByText('AI 建议先看搜索体验优化，再看实现细节。')).toBeInTheDocument()
  })
})

test('search page does not call the API for too-short queries', () => {
  routeState.search = 'q=a'
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  } as Response)

  renderSearchPage()

  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeDisabled()
  // 输入过短的提示只留在 AI 按钮旁一处
  expect(screen.getByText('至少输入 2 个字符。')).toBeInTheDocument()
  expect(screen.queryByText('至少输入 2 个字符再搜索')).not.toBeInTheDocument()
})

test('search page shows an empty start state with exploration links when there is no query', () => {
  routeState.search = ''
  const fetchMock = vi.spyOn(global, 'fetch')

  renderSearchPage()

  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole('heading', { level: 1, name: '搜索结果' })).toBeInTheDocument()
  expect(screen.getByText('请输入关键词开始搜索')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: '浏览全部文章' })).toHaveAttribute('href', '/posts')
  expect(screen.getByRole('link', { name: '全部标签' })).toHaveAttribute('href', '/tags')
  expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeDisabled()
})

test('search page shows the no-result state with a zero count', async () => {
  routeState.search = 'q=量子计算'
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  } as Response)

  renderSearchPage()

  await waitFor(() => {
    expect(screen.getByText('未找到相关结果')).toBeInTheDocument()
  })
  expect(screen.getByRole('heading', { name: '结果 0' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeDisabled()
})

test('search page shows a danger error with a retry button that refetches', async () => {
  routeState.search = 'q=缓存'
  const fetchMock = vi
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: 'Internal server error' }),
    } as Response)
    .mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [post] }),
    } as Response)

  renderSearchPage()

  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('搜索失败，请稍后重试')

  fireEvent.click(screen.getByRole('button', { name: '重试' }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: '结果 1' })).toBeInTheDocument()
  })
})

test('search page uses the shared SWR data layer and apiMutate for AI summary', () => {
  const source = readFileSync(join(process.cwd(), 'src/app/(public)/search/SearchPageClient.tsx'), 'utf8')

  expect(source).toContain('useSWR')
  expect(source).toContain('apiFetcher')
  expect(source).toContain('apiMutate')
  expect(source).not.toContain('fetch(')
})
