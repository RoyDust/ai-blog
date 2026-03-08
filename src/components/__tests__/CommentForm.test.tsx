import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

  expect(screen.getByPlaceholderText('写下你的评论...')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '发表评论' })).toBeInTheDocument()
})

test('shows localized loading label while submitting', async () => {
  vi.spyOn(global, 'fetch').mockImplementation(
    () =>
      new Promise(() => {
      }) as Promise<Response>
  )

  render(<CommentForm postId="post-1" />)

  fireEvent.change(screen.getByPlaceholderText('写下你的评论...'), {
    target: { value: '测试评论' },
  })
  fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

  expect(await screen.findByRole('button', { name: '提交中...' })).toBeInTheDocument()
})
