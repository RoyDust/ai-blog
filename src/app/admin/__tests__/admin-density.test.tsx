import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import AdminPostsPage from '../posts/page'

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    status: 'authenticated',
    data: { user: { role: 'ADMIN' } },
  }),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe('admin density', () => {
  test('admin list pages render data table with bulk action affordance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: [
            {
              id: '1',
              title: 'Post 1',
              slug: 'post-1',
              published: false,
              viewCount: 10,
              createdAt: '2026-01-01T00:00:00Z',
              author: { name: 'Admin', email: 'admin@example.com' },
              category: null,
              _count: { comments: 0, likes: 0 },
            },
          ],
        }),
      })
    )

    render(<AdminPostsPage />)

    await waitFor(() => {
      expect(screen.getByText('批量操作')).toBeInTheDocument()
    })
  })
})
