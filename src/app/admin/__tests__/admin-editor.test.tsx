import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import AdminPostEditPage from '../posts/[id]/edit/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  useParams: () => ({ id: '1' }),
}))

describe('admin editor', () => {
  test('renders markdown editor as primary workspace', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: '1',
            title: 'Post 1',
            slug: 'post-1',
            content: '# Hello',
            excerpt: 'Excerpt',
            coverImage: '',
            published: false,
          },
        }),
      })
    )

    render(<AdminPostEditPage />)

    await waitFor(() => {
      expect(screen.getByText('后台编辑文章')).toBeInTheDocument()
    })

    expect(screen.getByText('实时预览')).toBeInTheDocument()
    expect(screen.getByText('发布面板')).toBeInTheDocument()
  })
})
