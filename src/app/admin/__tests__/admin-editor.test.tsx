import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminPostEditPage from '../posts/[id]/edit/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: '1' }),
  usePathname: () => '/admin/posts/1/edit',
  useSearchParams: () => new URLSearchParams(''),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('admin editor', () => {
  test('renders editorial inspector sections and top-level publish actions', async () => {
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

    expect(await screen.findByText('文章状态')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布文章' })).toBeInTheDocument()
    expect(screen.getByText('发布准备度')).toBeInTheDocument()
  })

  test('shows cover upload trigger', async () => {
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

    expect(await screen.findByRole('button', { name: '上传封面到七牛' })).toBeInTheDocument()
  })

  test('shows explicit publish state controls for drafts', async () => {
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

    expect((await screen.findAllByText('当前状态')).length).toBeGreaterThan(0)
    expect(screen.getByText('草稿')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '切换为已发布' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保持草稿' })).toBeDisabled()
  })

  test('updates slug from Chinese title with pinyin limit', async () => {
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

    const titleInput = await screen.findByLabelText('标题')
    fireEvent.change(titleInput, { target: { value: '如何用 Next.js 做一个现代博客' } })

    expect(screen.getByLabelText('Slug')).toHaveValue('ru-he-yong-next-js-zuo-yi-ge-xian-dai-bo-ke')
  })

  test('preserves manual slug edits when title changes later', async () => {
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

    const titleInput = await screen.findByLabelText('标题')
    const slugInput = screen.getByLabelText('Slug')

    fireEvent.change(titleInput, { target: { value: '如何用 Next.js 做一个现代博客' } })
    fireEvent.change(slugInput, { target: { value: 'my-custom-slug' } })
    fireEvent.change(titleInput, { target: { value: '另一篇中文标题' } })

    expect(screen.getByLabelText('Slug')).toHaveValue('my-custom-slug')
  })

  test('loads category select and tag checkboxes for editing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }) })
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
              categoryId: 'cat-1',
              tags: [{ id: 'tag-1', name: 'React', slug: 'react' }],
              published: false,
            },
          }),
        })
    )

    render(<AdminPostEditPage />)

    expect(await screen.findByLabelText('分类')).toHaveValue('cat-1')
    expect(await screen.findByRole('checkbox', { name: 'React' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Next.js' })).not.toBeChecked()
  })

  test('submits selected category and tag ids when saving', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }, { id: 'cat-2', name: '后端', slug: 'backend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }) })
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
            categoryId: 'cat-1',
            tags: [{ id: 'tag-1', name: 'React', slug: 'react' }],
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { slug: 'post-1' } }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    const categorySelect = await screen.findByLabelText('分类')
    fireEvent.change(categorySelect, { target: { value: 'cat-2' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Next.js' }))
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(4)
    })

    const fourthCall = fetchMock.mock.calls[3]
    expect(fourthCall[0]).toBe('/api/admin/posts/1')
    expect(fourthCall[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(String(fourthCall[1]?.body))).toMatchObject({
      categoryId: 'cat-2',
      tagIds: ['tag-1', 'tag-2'],
    })
  })
})
