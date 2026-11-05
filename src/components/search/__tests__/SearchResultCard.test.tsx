import { cleanup, render } from '@testing-library/react'
import { afterEach } from 'vitest'
import { expect, test } from 'vitest'
import { SearchResultCard } from '../SearchResultCard'

afterEach(() => {
  cleanup()
})

const basePost = {
  id: 'post-1',
  title: 'React 搜索体验优化',
  slug: 'react-search-experience',
  excerpt: '通过统一搜索入口与结果卡片来提升查找效率。',
  content: 'React 搜索体验可以通过结果摘要、标签和分类信息得到明显提升。',
  coverImage: null,
  createdAt: '2026-03-08T00:00:00.000Z',
  author: {
    id: 'user-1',
    name: 'Ada',
    image: null,
  },
  category: {
    name: '前端',
    slug: 'frontend',
  },
  tags: [
    {
      name: 'React',
      slug: 'react',
    },
  ],
  _count: {
    comments: 3,
    likes: 5,
  },
}

test('renders excerpt content and highlighted search query', () => {
  const { container, getAllByText, getByText } = render(<SearchResultCard post={basePost} query="搜索" />)

  expect(getByText('摘要')).toBeInTheDocument()
  expect(container).toHaveTextContent('通过统一搜索入口与结果卡片来提升查找效率。')
  expect(getAllByText('搜索').length).toBeGreaterThan(0)
  expect(container).not.toHaveTextContent('搜索命中')
})

test('falls back to body snippet when excerpt is missing', () => {
  const { container, getByText } = render(
    <SearchResultCard
      post={{
        ...basePost,
        excerpt: null,
      }}
      query="体验"
    />,
  )

  expect(getByText('正文片段')).toBeInTheDocument()
  expect(container).toHaveTextContent('React 搜索体验可以通过结果摘要')
})

test('centers body snippet around matched keyword instead of the document start', () => {
  const longContent =
    '这是一段很长的开场内容，用来模拟正文前部没有命中关键词的情况。'.repeat(8) +
    '真正相关的内容出现在这里：搜索命中后应该优先展示关键词附近的上下文，帮助用户快速判断。' +
    '后面还有一些补充说明，用来保证截取片段足够长。'.repeat(6)

  const { container } = render(
    <SearchResultCard
      post={{
        ...basePost,
        excerpt: null,
        content: longContent,
      }}
      query="搜索"
    />,
  )

  expect(container).toHaveTextContent('搜索命中后应该优先展示关键词附近的上下文')
  expect(container).not.toHaveTextContent('这是一段很长的开场内容，用来模拟正文前部没有命中关键词的情况。这是一段很长的开场内容')
})

test('does not render hit field tags', () => {
  const { queryByText } = render(<SearchResultCard post={basePost} query="搜索" />)

  expect(queryByText('标题命中')).not.toBeInTheDocument()
  expect(queryByText('摘要命中')).not.toBeInTheDocument()
  expect(queryByText('正文命中')).not.toBeInTheDocument()
})

test('renders as the shared editorial list row with text-only meta', () => {
  const { container, getByRole, getByText } = render(
    <SearchResultCard post={{ ...basePost, viewCount: 1204 }} query="搜索" />,
  )

  expect(container.querySelector('article.ed-row')).not.toBeNull()
  expect(getByRole('link', { name: /React 搜索\s?体验优化/ })).toHaveAttribute('href', '/posts/react-search-experience')
  expect(getByRole('link', { name: '前端' })).toHaveAttribute('href', '/categories/frontend')
  expect(getByRole('link', { name: '#React' })).toHaveAttribute('href', '/tags/react')
  expect(container).toHaveTextContent('阅读 1,204')
  expect(container).toHaveTextContent('评论 3')
  expect(container).toHaveTextContent('点赞 5')
  expect(getByText('摘要')).toBeInTheDocument()
  // 单作者博客，不再写「作者 X · 结果已保留原始内容片段…」
  expect(container).not.toHaveTextContent('结果已保留原始内容片段')
  const marks = container.querySelectorAll('mark')
  expect(marks.length).toBeGreaterThan(0)
  expect(marks[0].className).toContain('bg-[var(--ed-highlight)]')
  expect(container.querySelector('svg')).toBeNull()
})
