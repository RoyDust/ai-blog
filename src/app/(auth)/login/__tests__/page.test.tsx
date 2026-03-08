import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import LoginPage from '../page'

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('error=not-admin'),
}))

describe('login page', () => {
  test('shows a non-admin message when redirected from /admin', () => {
    render(<LoginPage />)

    expect(screen.getByText(/管理员账号/)).toBeInTheDocument()
  })
})
