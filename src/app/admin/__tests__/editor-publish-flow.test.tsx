import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminPostEditPage from '../posts/[id]/edit/page'

const router = { push: vi.fn(), back: vi.fn(), replace: vi.fn() }
let searchParams = new URLSearchParams('')

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useParams: () => ({ id: '1' }),
  usePathname: () => '/admin/posts/1/edit',
  useSearchParams: () => searchParams,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  router.push.mockReset()
  router.back.mockReset()
  router.replace.mockReset()
  searchParams = new URLSearchParams('')
})

describe('editor publish flow', () => {
  test('reads ?panel= and reflects active inspector tab', async () => {
    searchParams = new URLSearchParams('panel=metadata')

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
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
    )

    render(<AdminPostEditPage />)

    expect(await screen.findByRole('button', { name: '元数据' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('updates ?panel= when switching inspector tabs', async () => {
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
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
    )

    render(<AdminPostEditPage />)

    fireEvent.click(await screen.findByRole('button', { name: '准备度' }))

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith(expect.stringContaining('panel=readiness'), { scroll: false })
    })
  })

  test('submits published=true when clicking publish action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({
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
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { slug: 'post-1' } }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    fireEvent.click(await screen.findByRole('button', { name: '发布文章' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    const fourthCall = fetchMock.mock.calls[3]
    expect(fourthCall[0]).toBe('/api/admin/posts/1')
    expect(fourthCall[1]).toMatchObject({ method: 'PATCH' })
    expect(JSON.parse(String(fourthCall[1]?.body))).toMatchObject({ published: true })
  })
})

