import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminPostEditPage from '../posts/[id]/edit/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: '1' }),
  usePathname: () => '/admin/posts/1/edit',
  useSearchParams: () => new URLSearchParams(''),
}))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function waitForMetadataInspector() {
  await screen.findByText('分类、标签与封面图')
}

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

    expect(await screen.findByText('发布设置')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布文章' })).toBeInTheDocument()
    expect(screen.getByText('发布清单')).toBeInTheDocument()
    expect(screen.getByText('分类、标签与封面图')).toBeInTheDocument()
    expect(screen.getByText('永久链接：/posts/post-1')).toBeInTheDocument()
  })

  test('shows cover upload and gallery picker triggers', async () => {
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

    await waitForMetadataInspector()

    expect(await screen.findByRole('button', { name: '上传并保存到图库' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '从图库选择' })).toBeInTheDocument()
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

    expect(await screen.findByText('发布状态')).toBeInTheDocument()
    expect(screen.getAllByText('草稿').length).toBeGreaterThan(0)
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
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })
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

    await waitForMetadataInspector()

    expect(await screen.findByLabelText('分类')).toHaveTextContent('前端')
    expect(await screen.findByRole('checkbox', { name: 'React' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Next.js' })).not.toBeChecked()
  })

  test('submits selected category and tag ids when saving', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }, { id: 'cat-2', name: '后端', slug: 'backend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })
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

    await waitForMetadataInspector()

    fireEvent.click(await screen.findByLabelText('分类'))
    fireEvent.click(await screen.findByRole('option', { name: '后端' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Next.js' }))
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    const fifthCall = fetchMock.mock.calls[4]
    expect(fifthCall[0]).toBe('/api/admin/posts/1')
    expect(fifthCall[1]).toMatchObject({
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(String(fifthCall[1]?.body))).toMatchObject({
      categoryId: 'cat-2',
      tagIds: ['tag-1', 'tag-2'],
    })
  })

  test('submits selected series assignment when saving', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [{ id: 'series-1', title: 'Next.js 系列', slug: 'nextjs-series' }] }) })
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
            seriesId: '',
            seriesOrder: 0,
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { slug: 'post-1' } }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    await waitForMetadataInspector()

    fireEvent.click(await screen.findByLabelText('所属系列'))
    fireEvent.click(await screen.findByRole('option', { name: 'Next.js 系列' }))
    fireEvent.change(screen.getByLabelText('系列排序'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    const payload = JSON.parse(String(fetchMock.mock.calls[4][1]?.body))
    expect(payload).toMatchObject({
      seriesId: 'series-1',
      seriesOrder: 2,
    })
  })
})
