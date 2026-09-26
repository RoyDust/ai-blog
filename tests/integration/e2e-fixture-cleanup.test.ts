import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeEach, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { purgeOwnedPost } from '../../e2e/post-fixtures'
import { withResourceScope } from '../../e2e/resource-scope'

let ownerId: string
const taskIds: string[] = []
beforeEach(async () => {
  vi.stubEnv('E2E_DISPOSABLE_DATABASE', '1')
  ownerId = randomUUID()
  await prisma.user.create({ data: { id: ownerId, email: ownerId + '@fixture.test' } })
})
afterEach(async () => {
  vi.unstubAllEnvs()
  await prisma.aiTask.deleteMany({ where: { id: { in: taskIds.splice(0) } } })
  await prisma.post.deleteMany({ where: { authorId: ownerId } })
  await prisma.user.delete({ where: { id: ownerId } })
})
afterAll(async () => prisma.$disconnect())
const createPost = () => prisma.post.create({ data: { title: 'Owned fixture', slug: randomUUID(), content: 'Body', authorId: ownerId } })

test('removes the exact post, relationships and terminal tasks after an assertion failure', async () => {
  const original = new Error('failure after UI creation')
  const owned = await createPost()
  const untouched = await createPost()
  const comment = await prisma.comment.create({ data: { postId: owned.id, content: 'Owned reply' } })
  const task = await prisma.aiTask.create({ data: { type: 'post-summary', source: 'single-post', status: 'SUCCEEDED', createdById: ownerId, items: { create: { postId: owned.id, status: 'SUCCEEDED', action: 'summary' } } } })
  taskIds.push(task.id)
  const notification = await prisma.notification.create({ data: { type: 'AI_TASK_SUCCEEDED', title: 'Owned completion', entityType: 'aiTask', entityId: task.id, recipients: { create: { userId: ownerId } } } })
  await expect(withResourceScope(async (defer) => {
    defer(() => purgeOwnedPost(owned.id, owned.slug))
    throw original
  })).rejects.toBe(original)
  expect(await prisma.post.findUnique({ where: { id: owned.id } })).toBeNull()
  expect(await prisma.comment.findUnique({ where: { id: comment.id } })).toBeNull()
  expect(await prisma.aiTask.findUnique({ where: { id: task.id } })).toBeNull()
  expect(await prisma.aiTaskItem.count({ where: { taskId: task.id } })).toBe(0)
  expect(await prisma.notification.findUnique({ where: { id: notification.id } })).toBeNull()
  expect(await prisma.notificationRecipient.count({ where: { notificationId: notification.id } })).toBe(0)
  expect(await prisma.post.findUnique({ where: { id: untouched.id } })).not.toBeNull()
})
test('rejects mismatched ownership and exposes both assertion and cleanup failures', async () => {
  const owned = await createPost()
  const original = new Error('original assertion')
  let caught: unknown
  try {
    await withResourceScope(async (defer) => {
      defer(() => purgeOwnedPost(owned.id, 'different-slug'))
      throw original
    })
  } catch (error) { caught = error }
  expect(caught).toBeInstanceOf(AggregateError)
  expect((caught as AggregateError).errors[0]).toBe(original)
  expect((caught as AggregateError).errors[1].message).toMatch(/identity/)
  expect(await prisma.post.findUnique({ where: { id: owned.id } })).not.toBeNull()
})
test('requires an explicit disposable database flag before deletion', async () => {
  const owned = await createPost()
  vi.stubEnv('E2E_DISPOSABLE_DATABASE', '')
  await expect(purgeOwnedPost(owned.id, owned.slug)).rejects.toThrow(/E2E_DISPOSABLE_DATABASE/)
  expect(await prisma.post.findUnique({ where: { id: owned.id } })).not.toBeNull()
})
