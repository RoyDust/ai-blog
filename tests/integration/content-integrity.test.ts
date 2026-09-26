import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, test } from 'vitest'
import { prisma } from '@/lib/prisma'
import { createPublicComment } from '@/lib/comments'
import { getPublishedPostsPage } from '@/lib/posts'
import { getTagDetail } from '@/lib/taxonomy'

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
let ownerId: string
const tagIds: string[] = []
beforeEach(async () => {
  ownerId = randomUUID()
  await prisma.user.create({ data: { id: ownerId, email: ownerId + '@integration.test' } })
})
afterEach(async () => {
  await prisma.comment.deleteMany({ where: { post: { authorId: ownerId } } })
  await prisma.post.deleteMany({ where: { authorId: ownerId } })
  await prisma.tag.deleteMany({ where: { id: { in: tagIds.splice(0) } } })
  await prisma.user.delete({ where: { id: ownerId } })
})
afterAll(async () => { await pool.end(); await prisma.$disconnect() })
const post = (slug = randomUUID()) => prisma.post.create({ data: { authorId: ownerId, title: slug, slug, content: 'Body', published: true } })
const reply = (postId: string, parentId?: string) => createPublicComment({ postId, parentId, content: 'Reply', browserId: 'integration', authorLabel: 'Test' })

describe('public content integrity in PostgreSQL', () => {
  test('allows public same-post replies and rejects foreign, hidden, deleted, or missing parents', async () => {
    const a = await post(); const b = await post()
    const parent = await prisma.comment.create({ data: { postId: a.id, content: 'Parent', status: 'APPROVED' } })
    expect((await reply(a.id, parent.id)).comment.parentId).toBe(parent.id)
    await expect(reply(b.id, parent.id)).rejects.toMatchObject({ status: 404 })
    await expect(reply(a.id, randomUUID())).rejects.toMatchObject({ status: 404 })
    await prisma.comment.update({ where: { id: parent.id }, data: { status: 'PENDING' } })
    await expect(reply(a.id, parent.id)).rejects.toMatchObject({ status: 404 })
    await prisma.comment.update({ where: { id: parent.id }, data: { status: 'APPROVED', deletedAt: new Date() } })
    await expect(reply(a.id, parent.id)).rejects.toMatchObject({ status: 404 })
    expect(await prisma.comment.count({ where: { postId: b.id } })).toBe(0)
    await prisma.post.update({ where: { id: a.id }, data: { published: false } })
    await expect(reply(a.id)).rejects.toMatchObject({ status: 404 })
  })

  test.each(['deletedAt', 'status'] as const)('rechecks a parent after concurrent %s mutation commits', async (field) => {
    const a = await post()
    const parent = await prisma.comment.create({ data: { postId: a.id, content: 'Parent', status: 'APPROVED' } })
    const blocker = await pool.connect()
    try {
      await blocker.query('BEGIN')
      await blocker.query(field === 'status' ? "UPDATE comments SET status = 'PENDING' WHERE id = $1" : 'UPDATE comments SET "deletedAt" = NOW() WHERE id = $1', [parent.id])
      const pending = reply(a.id, parent.id).then(() => 'inserted', (e: { status: number }) => e.status)
      const deadline = Date.now() + 5000
      while (true) {
        const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM comments%' AND pid <> pg_backend_pid()")
        if (waiting.rowCount) break
        if (Date.now() > deadline) throw new Error('reply did not wait for the parent row lock')
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      await blocker.query('COMMIT')
      expect(await pending).toBe(404)
      expect(await prisma.comment.count({ where: { parentId: parent.id } })).toBe(0)
    } finally { await blocker.query('ROLLBACK'); blocker.release() }
  })

  test('tag slug reuse selects only the new active identity for lists, counts, and pages', async () => {
    const slug = 'tag-' + randomUUID()
    const oldTag = await prisma.tag.create({ data: { name: 'Old', slug } }); tagIds.push(oldTag.id)
    const old = await post()
    await prisma.post.update({ where: { id: old.id }, data: { tags: { connect: { id: oldTag.id } } } })
    await prisma.tag.update({ where: { id: oldTag.id }, data: { deletedAt: new Date() } })
    const current = await prisma.tag.create({ data: { name: 'Current', slug } }); tagIds.push(current.id)
    const visible = await Promise.all([post(), post(), post()])
    for (const item of visible) await prisma.post.update({ where: { id: item.id }, data: { tags: { connect: { id: current.id } } } })
    const draft = await post(); const deleted = await post()
    await prisma.post.update({ where: { id: draft.id }, data: { published: false, tags: { connect: { id: current.id } } } })
    await prisma.post.update({ where: { id: deleted.id }, data: { deletedAt: new Date(), tags: { connect: { id: current.id } } } })
    const first = await getTagDetail(slug, { limit: 2, page: 1 })
    const second = await getTagDetail(slug, { limit: 2, page: 2 })
    expect(first?.pagination).toMatchObject({ total: 3, totalPages: 2 })
    expect(new Set([...first!.posts, ...second!.posts].map((p) => p.id))).toEqual(new Set(visible.map((p) => p.id)))
    const listing = await getPublishedPostsPage({ tag: slug, page: 1, limit: 10 })
    expect(listing.pagination.total).toBe(3)
    expect(listing.posts.map((p) => p.id)).not.toContain(old.id)
    await prisma.tag.update({ where: { id: current.id }, data: { deletedAt: new Date() } })
    expect(await getTagDetail(slug)).toBeNull()
    expect((await getPublishedPostsPage({ tag: slug, page: 1, limit: 10 })).posts).toEqual([])
  })
})
