import { beforeEach, describe, expect, test, vi } from 'vitest'

const { deleteMany, create, count, findFirst } = vi.hoisted(() => ({
  deleteMany: vi.fn(),
  create: vi.fn(),
  count: vi.fn(),
  findFirst: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    like: { deleteMany, create, count, findFirst },
  },
}))

import { ValidationError } from '@/lib/api-errors'
import { getLikeState, toggleLike } from '@/lib/likes'

const anonymous = { userId: null, browserId: 'anon_actor' }
const member = { userId: 'user-1', browserId: null }

describe('toggleLike', () => {
  beforeEach(() => {
    deleteMany.mockReset()
    create.mockReset()
    count.mockReset()
    findFirst.mockReset()
    count.mockResolvedValue(3)
  })

  test('creates a like when no row matched the identity', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockResolvedValue({ id: 'like-1' })

    await expect(toggleLike('post-1', anonymous)).resolves.toEqual({ liked: true, count: 3 })
    expect(deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1', OR: [{ browserId: 'anon_actor' }] } })
    expect(create).toHaveBeenCalledWith({ data: { postId: 'post-1', userId: null, browserId: 'anon_actor' } })
  })

  test('removes the like and skips create when a row matched', async () => {
    deleteMany.mockResolvedValue({ count: 1 })

    await expect(toggleLike('post-1', anonymous)).resolves.toEqual({ liked: false, count: 3 })
    expect(create).not.toHaveBeenCalled()
  })

  test('matches either the user or the browser identity for logged-in visitors', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockResolvedValue({ id: 'like-1' })

    await toggleLike('post-1', { userId: 'user-1', browserId: 'anon_actor' })

    expect(deleteMany).toHaveBeenCalledWith({
      where: { postId: 'post-1', OR: [{ userId: 'user-1' }, { browserId: 'anon_actor' }] },
    })
    expect(create).toHaveBeenCalledWith({ data: { postId: 'post-1', userId: 'user-1', browserId: 'anon_actor' } })
  })

  test('treats a unique constraint race as already liked', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockRejectedValue({ code: 'P2002', meta: { target: ['postId', 'browserId'] } })

    await expect(toggleLike('post-1', anonymous)).resolves.toEqual({ liked: true, count: 3 })
  })

  test('rethrows non-conflict database errors', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockRejectedValue(new Error('connection lost'))

    await expect(toggleLike('post-1', member)).rejects.toThrow('connection lost')
  })

  test('rejects a toggle without any identity before touching the database', async () => {
    await expect(toggleLike('post-1', { userId: null, browserId: null })).rejects.toBeInstanceOf(ValidationError)
    expect(deleteMany).not.toHaveBeenCalled()
  })
})

describe('getLikeState', () => {
  beforeEach(() => {
    count.mockReset()
    findFirst.mockReset()
    count.mockResolvedValue(7)
  })

  test('reports liked when any identity owns a like', async () => {
    findFirst.mockResolvedValue({ id: 'like-1' })

    await expect(getLikeState('post-1', { userId: 'user-1', browserId: 'anon_actor' })).resolves.toEqual({ liked: true, count: 7 })
    expect(findFirst).toHaveBeenCalledWith({
      where: { postId: 'post-1', OR: [{ userId: 'user-1' }, { browserId: 'anon_actor' }] },
      select: { id: true },
    })
  })

  test('returns the count only when the visitor has no identity', async () => {
    await expect(getLikeState('post-1', { userId: null, browserId: null })).resolves.toEqual({ liked: false, count: 7 })
    expect(findFirst).not.toHaveBeenCalled()
  })
})
