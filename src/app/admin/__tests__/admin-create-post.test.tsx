import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminCreatePostPage from '../posts/new/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/admin/posts/new',
  useSearchParams: () => new URLSearchParams(''),
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('admin create post', () => {
  async function openMetadataDialog() {
    fireEvent.click(await screen.findByRole('button', { name: '元数据' }))
  }

  test('renders new post workspace in admin style', () => {
    render(<AdminCreatePostPage />)

    expect(screen.getByRole('heading', { name: '新建文章' })).toBeInTheDocument()
    expect(screen.getByText('文章状态')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存草稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '发布文章' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'AI 工作台' })).toBeInTheDocument()
    expect(screen.getByText('发布准备度')).toBeInTheDocument()
    expect(screen.getByText('实时预览')).toBeInTheDocument()
  })

  test('auto-generates a max-60 pinyin slug from Chinese title', () => {
    render(<AdminCreatePostPage />)

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '如何用 Next.js 做一个现代博客' },
    })

    expect(screen.getByLabelText('Slug')).toHaveValue('ru-he-yong-next-js-zuo-yi-ge-xian-dai-bo-ke')
  })

  test('keeps manual slug after user edits it', () => {
    render(<AdminCreatePostPage />)

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '如何用 Next.js 做一个现代博客' },
    })
    fireEvent.change(screen.getByLabelText('Slug'), {
      target: { value: 'my-custom-slug' },
    })
    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '另一篇中文标题' },
    })

    expect(screen.getByLabelText('Slug')).toHaveValue('my-custom-slug')
  })

  test('loads category select and tag checkboxes for new post', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }),
        })
    )

    render(<AdminCreatePostPage />)

    await openMetadataDialog()

    expect(await screen.findByLabelText('分类')).toBeInTheDocument()
    expect(await screen.findByRole('checkbox', { name: 'React' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Next.js' })).toBeInTheDocument()
  })

  test('submits selected category and tag ids when creating post', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { slug: 'ru-he-yong-next-js' } }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCreatePostPage />)

    fireEvent.change(screen.getByLabelText('标题'), {
      target: { value: '如何用 Next.js' },
    })
    fireEvent.change(screen.getByLabelText('内容'), {
      target: { value: '# Hello' },
    })

    await openMetadataDialog()

    await screen.findByRole('option', { name: '前端' })
    const categorySelect = screen.getByLabelText('分类')
    fireEvent.change(categorySelect, { target: { value: 'cat-1' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'React' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Next.js' }))
    fireEvent.click(screen.getByRole('button', { name: '保存草稿' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    const thirdCall = fetchMock.mock.calls[2]
    expect(thirdCall[0]).toBe('/api/admin/posts')
    expect(thirdCall[1]).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    expect(JSON.parse(String(thirdCall[1]?.body))).toMatchObject({
      categoryId: 'cat-1',
      tagIds: ['tag-1', 'tag-2'],
    })
  })


  test('fills title slug excerpt category and tags from AI metadata', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }, { id: 'tag-2', name: 'Next.js', slug: 'nextjs' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            title: 'Next.js AI 元信息补全实践',
            slug: 'nextjs-ai-metadata',
            excerpt: '用 AI 一次性补齐博客文章标题、摘要、分类和标签。',
            categorySlug: 'frontend',
            tagSlugs: ['react', 'nextjs'],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminCreatePostPage />)

    fireEvent.change(screen.getByLabelText('内容'), {
      target: { value: '# 正文\n\n这是一篇关于 Next.js 和 AI 写作体验的文章。' },
    })

    fireEvent.click(await screen.findByRole('button', { name: '元数据' }))
    await screen.findByRole('option', { name: '前端' })
    fireEvent.click(screen.getByRole('button', { name: 'AI 补全元信息' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/posts/metadata',
        expect.objectContaining({ method: 'POST' })
      )
    })

    expect(await screen.findByDisplayValue('Next.js AI 元信息补全实践')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toHaveValue('nextjs-ai-metadata')
    expect(screen.getByDisplayValue('用 AI 一次性补齐博客文章标题、摘要、分类和标签。')).toBeInTheDocument()
    expect(screen.getByLabelText('分类')).toHaveValue('cat-1')
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Next.js' })).toBeChecked()
  })

  test('hydrates legacy draft without categoryId and tagIds', () => {
    window.localStorage.setItem(
      'author:draft:new',
      JSON.stringify({
        title: '旧草稿',
        slug: 'jiu-cao-gao',
        content: '# Hello',
        excerpt: '摘要',
        coverImage: '',
        published: false,
      })
    )

    render(<AdminCreatePostPage />)

    expect(screen.getByText('标签：未选择')).toBeInTheDocument()
    expect(screen.getByText('分类：未选择')).toBeInTheDocument()
  })
})
