import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { getPostLoginRedirect } from '@/lib/login-redirect'
import LoginPage from '../page'

const { getSession, searchParams, signIn } = vi.hoisted(() => ({
  getSession: vi.fn(),
  searchParams: { value: 'error=not-admin' },
  signIn: vi.fn(),
}))

vi.mock('next-auth/react', () => ({
  getSession,
  signIn,
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(searchParams.value),
}))

describe('login page', () => {
  beforeEach(() => {
    signIn.mockReset()
    getSession.mockReset()
    searchParams.value = 'error=not-admin'
  })

  test('shows a non-admin message when redirected from /admin', () => {
    render(<LoginPage />)

    expect(screen.getByText(/管理员账号/)).toBeInTheDocument()
  })

  test('uses admin as the default credentials callback', async () => {
    signIn.mockResolvedValueOnce({ error: 'CredentialsSignin' })
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'roy@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: /进入后台/ }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith('credentials', {
        email: 'roy@example.com',
        password: 'correct-password',
        redirect: false,
        callbackUrl: '/admin',
      }),
    )
  })

  test('passes a safe admin callback through to credentials login', async () => {
    searchParams.value = 'callbackUrl=%2Fadmin%2Fposts'
    signIn.mockResolvedValueOnce({ error: 'CredentialsSignin' })
    render(<LoginPage />)

    fireEvent.change(screen.getByLabelText('邮箱'), { target: { value: 'roy@example.com' } })
    fireEvent.change(screen.getByLabelText('密码'), { target: { value: 'correct-password' } })
    fireEvent.click(screen.getByRole('button', { name: /进入后台/ }))

    await waitFor(() =>
      expect(signIn).toHaveBeenCalledWith(
        'credentials',
        expect.objectContaining({ callbackUrl: '/admin/posts' }),
      ),
    )
  })

  test('uses role-aware redirect as the default GitHub callback', () => {
    render(<LoginPage />)

    fireEvent.click(screen.getByRole('button', { name: '使用 GitHub 登录' }))

    expect(signIn).toHaveBeenCalledWith('github', { callbackUrl: '/auth/redirect' })
  })

  test('redirects admins to admin and non-admin users to home after login', () => {
    expect(getPostLoginRedirect('ADMIN', '/admin/posts')).toBe('/admin/posts')
    expect(getPostLoginRedirect('USER', '/admin/posts')).toBe('/')
    expect(getPostLoginRedirect(undefined, '/admin/posts')).toBe('/')
    expect(getPostLoginRedirect('ADMIN', '/posts')).toBe('/admin')
  })
})
