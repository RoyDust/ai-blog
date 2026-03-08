import { render, screen } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { UserNav } from '../UserNav'

vi.mock('next-auth/react', () => ({
  signOut: vi.fn(),
  useSession: vi.fn(),
}))

import { useSession } from 'next-auth/react'

test('renders localized loading state', () => {
  vi.mocked(useSession).mockReturnValue({ data: null, status: 'loading' } as never)

  render(<UserNav />)

  expect(screen.getByText('加载中...')).toBeInTheDocument()
})

test('renders localized authenticated navigation', () => {
  vi.mocked(useSession).mockReturnValue({
    data: { user: { name: 'RoyDust', email: 'roy@example.com' } },
    status: 'authenticated',
  } as never)

  render(<UserNav />)

  expect(screen.getByRole('link', { name: '我的收藏' })).toHaveAttribute('href', '/bookmarks')
  expect(screen.getByRole('link', { name: '写文章' })).toHaveAttribute('href', '/admin/posts/new')
  expect(screen.getByRole('link', { name: '控制台' })).toHaveAttribute('href', '/admin')
  expect(screen.getByRole('button', { name: '退出' })).toBeInTheDocument()
})

test('renders localized guest navigation', () => {
  vi.mocked(useSession).mockReturnValue({ data: null, status: 'unauthenticated' } as never)

  render(<UserNav />)

  expect(screen.getByRole('link', { name: '登录' })).toHaveAttribute('href', '/login')
  expect(screen.getByRole('link', { name: '注册' })).toHaveAttribute('href', '/register')
})
