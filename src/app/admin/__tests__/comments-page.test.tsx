import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import AdminCommentsPage from '../comments/page'

describe('admin comments page', () => {
  test('renders anonymous comment authors and moderation status', async () => {
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
        }),
      }),
    )

    render(<AdminCommentsPage />)

    await waitFor(() => {
      expect(screen.getByText('匿名访客')).toBeInTheDocument()
    })

    expect(screen.getByText('匿名评论内容')).toBeInTheDocument()
    expect(screen.getAllByText('待审核').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '批量通过' })).toBeInTheDocument()
  })

  test('does not crash when admin comments api returns an empty non-json response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        headers: { get: () => 'text/html; charset=utf-8' },
        text: async () => '',
      }),
    )

    render(<AdminCommentsPage />)

    await waitFor(() => {
      expect(screen.getByText('暂无评论')).toBeInTheDocument()
    })
  })
})
