import { render, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import SearchPage from '../page'

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('q=搜索'),
}))

beforeEach(() => {
  vi.restoreAllMocks()
})

test('search page preserves search result content snippet', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({
      success: true,
      data: [
        {
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
        },
      ],
    }),
  } as Response)

  const { container, getByText } = render(<SearchPage />)

  await waitFor(() => {
    expect(getByText('正文片段')).toBeInTheDocument()
    expect(container).toHaveTextContent('搜索结果页面应该保留正文片段，帮助用户快速判断是否相关。')
  })
})
