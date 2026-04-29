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


  test('fills edit metadata from AI suggestions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: '1',
            title: '旧标题',
            slug: 'old-title',
            content: '# Hello',
            excerpt: '',
            coverImage: '',
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            title: 'AI 编辑后的标题',
            slug: 'ai-edited-title',
            excerpt: 'AI 生成的摘要。',
            categorySlug: 'frontend',
            tagSlugs: ['react'],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    expect(await screen.findByDisplayValue('旧标题')).toBeInTheDocument()
    await screen.findByRole('option', { name: '前端' })
    fireEvent.click(screen.getByRole('button', { name: 'AI 补全元信息' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/posts/metadata', expect.objectContaining({ method: 'POST' }))
    })

    expect(await screen.findByDisplayValue('AI 编辑后的标题')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toHaveValue('ai-edited-title')
    expect(screen.getByDisplayValue('AI 生成的摘要。')).toBeInTheDocument()
    expect(screen.getByLabelText('分类')).toHaveValue('cat-1')
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
  })

})
