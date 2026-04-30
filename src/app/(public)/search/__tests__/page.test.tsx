import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import SearchPage from '../page'

const routeState = vi.hoisted(() => ({ search: 'q=搜索' }))

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

beforeEach(() => {
  routeState.search = 'q=搜索'
  vi.restoreAllMocks()
})

test('search page preserves search result content snippet without requesting AI automatically', async () => {
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: [post],
    }),
  } as Response)

  const { container } = render(<SearchPage />)

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=%E6%90%9C%E7%B4%A2')
    expect(screen.getByText('正文片段')).toBeInTheDocument()
    expect(container).toHaveTextContent('搜索结果页面应该保留正文片段，帮助用户快速判断是否相关。')
  })
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

  render(<SearchPage />)

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeEnabled()
  })

  fireEvent.click(screen.getByRole('button', { name: 'AI 搜索摘要' }))

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/search?q=%E6%90%9C%E7%B4%A2&ai=1')
    expect(screen.getByText('AI 建议先看搜索体验优化，再看实现细节。')).toBeInTheDocument()
  })
})

test('search page does not call the API for too-short queries', () => {
  routeState.search = 'q=a'
  const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  } as Response)

  render(<SearchPage />)

  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'AI 搜索摘要' })).toBeDisabled()
  expect(screen.getByText('至少输入 2 个字符再搜索')).toBeInTheDocument()
})
