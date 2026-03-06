import { describe, expect, test, vi } from 'vitest'

const redirectMock = vi.fn()

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}))

describe('author workflow', () => {
  test('/write redirects to /admin/posts/new', async () => {
    const { default: WritePage } = await import('../page')
    await WritePage()
    expect(redirectMock).toHaveBeenCalledWith('/admin/posts/new')
  })
})
