import { render, waitFor } from '@testing-library/react'
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
  test('admin list pages render primary-tinted creation actions', async () => {
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

    const { container } = render(<AdminPostsPage />)

    await waitFor(() => {
      expect(container.querySelector('a[href="/admin/posts/1/edit"]')).toBeTruthy()
    })

    const createLink = container.querySelector('a[href="/admin/posts/new"]')
    expect(createLink).toBeTruthy()
    expect(createLink?.querySelector('button')?.className).toContain('bg-[var(--primary)]')

    const activeFilter = Array.from(container.querySelectorAll('button')).find((button) => button.className.includes('bg-[var(--primary)]'))
    expect(activeFilter).toBeTruthy()
  })
})
