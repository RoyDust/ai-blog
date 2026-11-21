import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getLikeState, toggleLike } from '@/lib/likes'

let ownerId: string
beforeEach(async () => {
  ownerId = randomUUID()
  await prisma.user.create({ data: { id: ownerId, email: ownerId + '@integration.test' } })
})
afterEach(async () => {
  await prisma.like.deleteMany({ where: { post: { authorId: ownerId } } })
  await prisma.post.deleteMany({ where: { authorId: ownerId } })
  await prisma.user.delete({ where: { id: ownerId } })
})
afterAll(async () => prisma.$disconnect())
const createPost = () => prisma.post.create({ data: { authorId: ownerId, title: 'Liked post', slug: randomUUID(), content: 'Body', published: true } })
const anonymous = () => ({ userId: null, browserId: `anon_${randomUUID()}` })

describe('like toggle atomicity in PostgreSQL', () => {
  test('concurrent toggles from one identity leave at most one like row and never fail', async () => {
    const post = await createPost()
    const identity = anonymous()
    const results = await Promise.all(Array.from({ length: 8 }, () => toggleLike(post.id, identity)))
    const rows = await prisma.like.count({ where: { postId: post.id, browserId: identity.browserId } })
    expect(rows).toBeLessThanOrEqual(1)
    expect(results.every((result) => result.count <= 1)).toBe(true)
    expect((await getLikeState(post.id, identity)).liked).toBe(rows === 1)
  })

  test('sequential toggles flip the state without leaving duplicate rows', async () => {
    const post = await createPost()
    const identity = anonymous()
    expect(await toggleLike(post.id, identity)).toEqual({ liked: true, count: 1 })
    expect(await toggleLike(post.id, identity)).toEqual({ liked: false, count: 0 })
    expect(await toggleLike(post.id, identity)).toEqual({ liked: true, count: 1 })
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(1)
  })

  test('a logged-in like is recognised from another browser and toggled off by either identity', async () => {
    const post = await createPost()
    const laptop = { userId: ownerId, browserId: `anon_${randomUUID()}` }
    const phone = { userId: ownerId, browserId: `anon_${randomUUID()}` }
    expect(await toggleLike(post.id, laptop)).toEqual({ liked: true, count: 1 })
    expect((await getLikeState(post.id, phone)).liked).toBe(true)
    expect(await toggleLike(post.id, phone)).toEqual({ liked: false, count: 0 })
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(0)
  })

  test('an anonymous like survives login on the same browser and is not duplicated', async () => {
    const post = await createPost()
    const browserId = `anon_${randomUUID()}`
    expect(await toggleLike(post.id, { userId: null, browserId })).toEqual({ liked: true, count: 1 })
    const loggedIn = { userId: ownerId, browserId }
    expect((await getLikeState(post.id, loggedIn)).liked).toBe(true)
    expect(await toggleLike(post.id, loggedIn)).toEqual({ liked: false, count: 0 })
    expect(await toggleLike(post.id, loggedIn)).toEqual({ liked: true, count: 1 })
    expect(await prisma.like.count({ where: { postId: post.id } })).toBe(1)
  })
})
