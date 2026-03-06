import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import AdminCreatePostPage from '../posts/new/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

describe('admin create post', () => {
  test('renders new post workspace in admin style', () => {
    render(<AdminCreatePostPage />)

    expect(screen.getByRole('heading', { name: '新建文章' })).toBeInTheDocument()
    expect(screen.getByText('发布面板')).toBeInTheDocument()
    expect(screen.getByText('实时预览')).toBeInTheDocument()
  })
})
