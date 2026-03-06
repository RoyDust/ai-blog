import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/posts',
}))

describe('admin layout', () => {
  test('renders pro-lite shell with nav and breadcrumbs', async () => {
    const { AdminLayout } = await import('@/components/admin/shell/AdminLayout')

    render(
      <AdminLayout userLabel="Admin">
        <div>Posts content</div>
      </AdminLayout>
    )

    expect(screen.getByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '文章管理' })).toHaveAttribute('href', '/admin/posts')
    expect(screen.getByText('后台 / 内容 / 文章管理')).toBeInTheDocument()
    expect(screen.getByText('Posts content')).toBeInTheDocument()
  })
})
