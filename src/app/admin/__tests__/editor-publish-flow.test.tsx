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
  test('keeps publishing inspector sections mounted even with legacy ?panel=', async () => {
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

    expect(await screen.findByText('发布设置')).toBeInTheDocument()
    expect(screen.getByText('发布清单')).toBeInTheDocument()
    expect(screen.getByText('分类、标签与封面图')).toBeInTheDocument()
  })

  test('does not route static inspector sections through ?panel=', async () => {
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

    expect(await screen.findByText('分类、标签与封面图')).toBeInTheDocument()

    expect(router.replace).not.toHaveBeenCalled()
  })

  test('submits published=true and clears scheduling when clicking publish action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
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
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    const fifthCall = fetchMock.mock.calls[4]
    expect(fifthCall[0]).toBe('/api/admin/posts/1')
    expect(fifthCall[1]).toMatchObject({ method: 'PATCH' })
    const payload = JSON.parse(String(fifthCall[1]?.body))
    expect(payload).toMatchObject({ published: true })
    expect(payload).not.toHaveProperty('publishedAt')
    expect(payload).toHaveProperty('scheduledAt', null)
    expect(payload).not.toHaveProperty('allowComments')
    expect(payload).not.toHaveProperty('commentsEnabled')
  })

  test('submits future scheduled time when clicking schedule action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
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
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { slug: 'post-1' } }) })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    fireEvent.change(await screen.findByLabelText('定时发布时间'), {
      target: { value: '2099-01-01T10:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: '定时发布' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(5)
    })

    const payload = JSON.parse(String(fetchMock.mock.calls[4][1]?.body))
    expect(payload).toMatchObject({
      published: false,
      scheduledAt: '2099-01-01T10:30',
    })
  })

  test('fills edit metadata from field-level AI actions', async () => {
    const metadataSuggestion = {
      title: 'AI 编辑后的标题',
      slug: 'ai-edited-title',
      excerpt: 'AI 生成的摘要。',
      categorySlug: 'frontend',
      tagSlugs: ['react'],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })
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
        json: async () => ({ success: true, data: { output: { titles: [metadataSuggestion.title] } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { output: { slug: metadataSuggestion.slug } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { output: { categoryId: 'cat-1', categorySlug: metadataSuggestion.categorySlug } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { output: { existingTagIds: ['tag-1'], tagSlugs: metadataSuggestion.tagSlugs } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { summary: metadataSuggestion.excerpt } }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    expect(await screen.findByDisplayValue('旧标题')).toBeInTheDocument()
    await screen.findByRole('checkbox', { name: 'React' })
    fireEvent.click(screen.getByRole('button', { name: 'AI 补全标题' }))
    expect(await screen.findByDisplayValue('AI 编辑后的标题')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'AI 补全 Slug' }))
    await waitFor(() => {
      expect(screen.getByLabelText('Slug')).toHaveValue('ai-edited-title')
    })

    fireEvent.click(screen.getByRole('button', { name: 'AI 选择分类' }))
    await waitFor(() => {
      expect(screen.getByLabelText('分类')).toHaveTextContent('前端')
    })

    fireEvent.click(screen.getByRole('button', { name: 'AI 选择标签' }))
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
    })

    fireEvent.click(screen.getByRole('button', { name: 'AI 生成摘要' }))
    expect(await screen.findByDisplayValue('AI 生成的摘要。')).toBeInTheDocument()

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/ai/actions',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"slug"'),
        })
      )
    })

    expect(screen.getByDisplayValue('AI 编辑后的标题')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toHaveValue('ai-edited-title')
    expect(screen.getByDisplayValue('AI 生成的摘要。')).toBeInTheDocument()
    expect(screen.getByLabelText('分类')).toHaveTextContent('前端')
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
  })

  test('one-click AI generation replaces edit metadata while preserving title and content', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: '1',
            title: '旧标题',
            slug: 'old-title',
            content: '# 旧正文\n\n这是一段足够长的正文内容，用来触发一键 AI 文章信息生成。',
            excerpt: '旧摘要',
            seoDescription: '旧 SEO',
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
            taskId: 'task-1',
            modelId: 'model-1',
            articleInfo: {
              slug: 'ai-edited-info',
              excerpt: 'AI 编辑页摘要。',
              seoDescription: 'AI 编辑页 SEO 描述。',
              categoryId: 'cat-1',
              tagIds: ['tag-1'],
            },
            items: [],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    expect(await screen.findByDisplayValue('旧标题')).toBeInTheDocument()
    await screen.findByRole('checkbox', { name: 'React' })

    fireEvent.click(screen.getByRole('button', { name: '一键 AI 生成' }))
    expect(await screen.findByRole('heading', { name: '确认一键 AI 生成结果' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '应用这些结果' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Slug')).toHaveValue('ai-edited-info')
    })

    expect(screen.getByLabelText('标题')).toHaveValue('旧标题')
    expect(screen.getByLabelText('内容')).toHaveValue('# 旧正文\n\n这是一段足够长的正文内容，用来触发一键 AI 文章信息生成。')
    expect(screen.getByDisplayValue('AI 编辑页摘要。')).toBeInTheDocument()
    expect(screen.getByLabelText('SEO 描述')).toHaveValue('AI 编辑页 SEO 描述。')
    expect(screen.getByLabelText('分类')).toHaveTextContent('前端')
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/ai/actions/article-info',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"postId":"1"'),
      })
    )
  })

  test('one-click AI generation applies successful partial fields when one action fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'cat-1', name: '前端', slug: 'frontend' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: 'tag-1', name: 'React', slug: 'react' }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: '1',
            title: '旧标题',
            slug: 'old-title',
            content: '# 旧正文\n\n这是一段足够长的正文内容，用来触发一键 AI 文章信息生成。',
            excerpt: '旧摘要',
            seoDescription: '旧 SEO',
            coverImage: '',
            categoryId: '',
            tags: [],
            published: false,
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          success: false,
          error: 'Slug failed',
          data: {
            taskId: 'task-1',
            partial: true,
            failures: [{ action: 'slug', message: 'Slug failed' }],
            items: [
              { action: 'summary', output: { summary: 'AI 部分摘要。' } },
              { action: 'seo-description', output: { seoDescription: 'AI 部分 SEO 描述。' } },
              { action: 'category', output: { categoryId: 'cat-1', categoryName: '前端' } },
              { action: 'tags', output: { existingTagIds: ['tag-1'], names: ['React'] } },
            ],
          },
        }),
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPostEditPage />)

    expect(await screen.findByDisplayValue('旧标题')).toBeInTheDocument()
    await screen.findByRole('checkbox', { name: 'React' })

    fireEvent.click(screen.getByRole('button', { name: '一键 AI 生成' }))
    expect(await screen.findByRole('heading', { name: '确认一键 AI 生成结果' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '应用这些结果' }))

    expect(await screen.findByDisplayValue('AI 部分摘要。')).toBeInTheDocument()
    expect(screen.getByLabelText('Slug')).toHaveValue('old-title')
    expect(screen.getByLabelText('标题')).toHaveValue('旧标题')
    expect(screen.getByLabelText('内容')).toHaveValue('# 旧正文\n\n这是一段足够长的正文内容，用来触发一键 AI 文章信息生成。')
    expect(screen.getByLabelText('SEO 描述')).toHaveValue('AI 部分 SEO 描述。')
    expect(screen.getByLabelText('分类')).toHaveTextContent('前端')
    expect(screen.getByRole('checkbox', { name: 'React' })).toBeChecked()
    expect(screen.getByText('部分字段生成失败：Slug。请确认预览后应用其他可用结果。')).toBeInTheDocument()
  })

})
