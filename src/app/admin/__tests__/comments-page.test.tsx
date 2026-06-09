import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminCommentsPage from '../comments/page'

afterEach(() => {
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('admin comments page', () => {
  test('renders moderation buckets and inline triage actions', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: [
            {
              id: 'comment-1',
              content: '匿名评论内容',
              createdAt: '2026-01-02T00:00:00Z',
              status: 'PENDING',
              author: null,
              authorLabel: '匿名访客',
              post: { title: 'Recent Post', slug: 'recent-post' },
            },
          ],
          pagination: { page: 1, limit: 10, total: 125, totalPages: 13 },
          stats: { total: 125, pending: 12, approved: 100, rejected: 10, spam: 3 },
        }),
      }),
    )

    render(<AdminCommentsPage />)

    expect(await screen.findByText('评论收件箱')).toBeInTheDocument()
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/admin/comments?page=1&limit=10')
    expect(screen.getByText('125')).toBeInTheDocument()
    expect(screen.getAllByText('待审核').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已通过').length).toBeGreaterThan(0)
    expect(screen.getAllByText('已驳回').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '已隐藏' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '批量通过' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '通过' })).toBeInTheDocument()
  })

  test('does not crash when admin comments api returns an empty non-json response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON')
        },
      }),
    )

    render(<AdminCommentsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无评论')).toBeInTheDocument()
    })
  })

  test('restores cached comment filters after refresh before loading comments', async () => {
    window.localStorage.setItem(
      'admin:comments:list-filters',
      JSON.stringify({
        query: 'spam',
        statusFilter: 'REJECTED',
        page: 4,
        pageSize: 20,
      }),
    )
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 4, limit: 20, total: 0, totalPages: 1 },
        stats: { total: 0, pending: 0, approved: 0, rejected: 0, spam: 0 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCommentsPage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/comments?page=4&limit=20&q=spam&status=REJECTED')
    })
    expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/comments?page=1&limit=10')
    expect(await screen.findByLabelText('搜索评论')).toHaveValue('spam')
  })

  test('does not fire a fetch per keystroke while typing in search', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        stats: { total: 0, pending: 0, approved: 0, rejected: 0, spam: 0 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCommentsPage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    const input = screen.getByLabelText('搜索评论')
    fireEvent.change(input, { target: { value: 's' } })
    fireEvent.change(input, { target: { value: 'sp' } })
    fireEvent.change(input, { target: { value: 'spa' } })
    fireEvent.change(input, { target: { value: 'spam' } })

    // debounce window has not elapsed, so no additional fetch should fire
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('keeps the comments shell visible when switching filters after an empty result', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
        stats: { total: 0, pending: 0, approved: 0, rejected: 0, spam: 0 },
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCommentsPage />)

    await screen.findByText('暂无评论')

    fireEvent.click(screen.getByRole('button', { name: '待审核' }))

    expect(screen.getByText('评论收件箱')).toBeInTheDocument()
    expect(screen.queryByText(/^加载中\.\.\.$/)).not.toBeInTheDocument()
    expect(screen.getByText('正在加载评论队列...')).toBeInTheDocument()
  })

  test('approves a comment with optimistic update and silent refetch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{
            id: 'comment-1',
            content: '匿名评论内容',
            createdAt: '2026-01-02T00:00:00Z',
            status: 'PENDING',
            author: null,
            authorLabel: '匿名访客',
            post: { title: 'Recent Post', slug: 'recent-post' },
          }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          stats: { total: 1, pending: 1, approved: 0, rejected: 0, spam: 0 },
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({ success: true }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [{
            id: 'comment-1',
            content: '匿名评论内容',
            createdAt: '2026-01-02T00:00:00Z',
            status: 'APPROVED',
            author: null,
            authorLabel: '匿名访客',
            post: { title: 'Recent Post', slug: 'recent-post' },
          }],
          pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          stats: { total: 1, pending: 0, approved: 1, rejected: 0, spam: 0 },
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCommentsPage />)

    // PENDING row hint visible after initial load
    await screen.findByText('待你决策')

    fireEvent.click(screen.getByRole('button', { name: '通过' }))

    // optimistic update flips the row hint without waiting for the silent refetch
    await screen.findByText('已处理')

    // table never swaps to its loading text during the silent refetch
    expect(screen.queryByText('正在加载评论队列...')).not.toBeInTheDocument()
  })
})
