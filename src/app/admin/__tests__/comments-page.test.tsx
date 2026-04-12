import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminCommentsPage from '../comments/page'

afterEach(() => {
  vi.unstubAllGlobals()
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
        }),
      }),
    )

    render(<AdminCommentsPage />)

    expect(await screen.findByText('评论收件箱')).toBeInTheDocument()
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
})
