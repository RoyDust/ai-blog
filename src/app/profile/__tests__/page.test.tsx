import { describe, expect, test, vi } from 'vitest'

const redirect = vi.fn()

vi.mock('next/navigation', () => ({ redirect }))

describe('/profile retirement', () => {
  test('redirects profile page to admin', async () => {
    const { default: ProfilePage } = await import('../page')
    await ProfilePage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })

  test('redirects profile edit page to admin', async () => {
    const { default: ProfileEditPage } = await import('../edit/page')
    await ProfileEditPage()

    expect(redirect).toHaveBeenCalledWith('/admin')
  })
})
