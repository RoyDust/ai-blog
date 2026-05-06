import { describe, expect, test, vi } from 'vitest'

const updateUserRole = vi.fn(async () => ({
  id: 'user-1',
  email: 'admin@example.com',
  role: 'ADMIN',
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      update: updateUserRole,
    },
  },
}))

describe('POST /api/admin/set-admin', () => {
  test('returns not found and never promotes a user', async () => {
    const { POST } = await import('../route')
    const response = await POST()
    const payload = await response.json()

    expect(response.status).toBe(404)
    expect(payload.error).toBe('Not found')
    expect(updateUserRole).not.toHaveBeenCalled()
  })
})
