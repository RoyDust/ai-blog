import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { CommentForm } from '../CommentForm'

const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}))

vi.mock('@/lib/browser-id', () => ({
  getOrCreateBrowserId: () => 'browser-test-id',
}))

beforeEach(() => {
  refresh.mockReset()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

test('renders localized comment form copy', () => {
  render(<CommentForm postId="post-1" />)

  const textarea = screen.getByRole('textbox', { name: '写评论' })
  expect(textarea).toHaveAttribute('placeholder', '写下你的想法…')
  expect(textarea).toHaveAttribute('id', 'comment-content')
  expect(textarea.className).toContain('ed-textarea')
  expect(screen.getByRole('button', { name: '发表评论' }).className).toContain('ed-btn')
})

test('shows localized loading label while submitting', async () => {
  vi.spyOn(global, 'fetch').mockImplementation(
    () =>
      new Promise(() => {
      }) as Promise<Response>
  )

  render(<CommentForm postId="post-1" />)

  fireEvent.change(screen.getByRole('textbox', { name: '写评论' }), {
    target: { value: '测试评论' },
  })
  fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

  expect(await screen.findByRole('button', { name: '提交中...' })).toBeInTheDocument()
})

test('shows moderation feedback after submitting a comment', async () => {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { id: 'comment-1', status: 'PENDING' } }),
  } as Response)

  render(<CommentForm postId="post-1" />)

  fireEvent.change(screen.getByRole('textbox', { name: '写评论' }), {
    target: { value: '测试评论' },
  })
  fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

  expect(await screen.findByText('评论已提交，审核通过后会公开显示。')).toBeInTheDocument()
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce())
})

test('shows an inline validation error for empty comments', async () => {
  render(<CommentForm postId="post-1" />)

  fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('请输入评论内容')
  expect(screen.getByRole('textbox', { name: '写评论' })).toHaveAttribute('aria-invalid', 'true')
})

test('reply variant posts the parent id and uses an outline submit button', async () => {
  const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: { id: 'reply-1', status: 'PENDING' } }),
  } as Response)
  const onCancel = vi.fn()

  render(<CommentForm onCancel={onCancel} parentId="comment-1" postId="post-1" variant="reply" />)

  const submit = screen.getByRole('button', { name: '发表回复' })
  expect(submit.className).toContain('ed-btn-outline')

  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(onCancel).toHaveBeenCalledOnce()

  fireEvent.change(screen.getByRole('textbox', { name: '写回复' }), { target: { value: '回复内容' } })
  fireEvent.click(submit)

  expect(await screen.findByText('回复已提交，审核通过后会公开显示。')).toBeInTheDocument()
  const body = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
  expect(body).toEqual({ postId: 'post-1', content: '回复内容', parentId: 'comment-1' })
})
