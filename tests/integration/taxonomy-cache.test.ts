import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
const { invalidate, authorize } = vi.hoisted(() => ({ invalidate: vi.fn(), authorize: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: invalidate }))
vi.mock('@/lib/api-auth', () => ({ requireAdminSession: authorize }))
import * as categories from '@/app/api/admin/categories/route'
import * as tags from '@/app/api/admin/tags/route'
import { mutateTaxonomy } from '@/lib/taxonomy-mutations'

const ids = { category: [] as string[], tag: [] as string[] }
const guides: string[] = []
let owner: string
beforeEach(async () => {
  owner = randomUUID()
  await prisma.user.create({ data: { id: owner, email: owner + '@cache.test' } })
  authorize.mockResolvedValue({ user: { id: owner, role: 'ADMIN' } })
  invalidate.mockReset()
})
afterEach(async () => {
  await prisma.topicGuide.deleteMany({ where: { id: { in: guides.splice(0) } } })
  await prisma.post.deleteMany({ where: { authorId: owner } })
  await prisma.category.deleteMany({ where: { id: { in: ids.category.splice(0) } } })
  await prisma.tag.deleteMany({ where: { id: { in: ids.tag.splice(0) } } })
  await prisma.user.delete({ where: { id: owner } })
})
afterAll(() => prisma.$disconnect())
test('batch category deletion does not deadlock with moving a locked post between its categories', async () => {
  const a = await prisma.category.create({ data: { name: 'a-' + owner, slug: 'a-' + owner } })
  const b = await prisma.category.create({ data: { name: 'b-' + owner, slug: 'b-' + owner } })
  ids.category.push(a.id, b.id)
  const article = await prisma.post.create({ data: { authorId: owner, title: 'Concurrent', content: 'Body', slug: owner, categoryId: a.id, published: true } })
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
  const edit = await pool.connect()
  let deletion: Promise<unknown> | undefined
  try {
    await edit.query('BEGIN')
    await edit.query('UPDATE posts SET title = $1 WHERE id = $2', ['Locked', article.id])
    let locked!: () => void
    const ready = new Promise<void>((resolve) => { locked = resolve })
    deletion = mutateTaxonomy('category', [a.id, b.id], undefined, async (tx, liveIds) => {
      await tx.category.updateMany({ where: { id: { in: liveIds } }, data: { deletedAt: new Date() } })
      locked()
      return tx.post.updateMany({ where: { categoryId: { in: liveIds } }, data: { categoryId: null } })
    }).then(() => 'deleted', (error: unknown) => error)
    await ready
    await edit.query('UPDATE posts SET "categoryId" = $1 WHERE id = $2', [b.id, article.id])
    await edit.query('COMMIT')
    expect(await deletion).toBe('deleted')
    expect((await prisma.post.findUniqueOrThrow({ where: { id: article.id } })).categoryId).toBeNull()
  } finally { await edit.query('ROLLBACK'); edit.release(); await deletion; await pool.end() }
})
function request(family: string, method: string, data?: unknown) {
  return new Request('http://localhost/api/admin/' + family, { method, headers: { 'content-type': 'application/json' }, ...(data ? { body: JSON.stringify(data) } : {}) })
}
describe.each(['category', 'tag'] as const)('%s public invalidation', (kind) => {
  const family = kind === 'category' ? 'categories' : 'tags'
  const routes = kind === 'category' ? categories : tags
  test('create, rename, and delete invalidate old/new identities and affected posts after commit', async () => {
    const slug = 'cache-' + randomUUID()
    const create = await routes.POST(request(family, 'POST', { name: slug, slug }))
    const { data } = await create.json(); ids[kind].push(data.id)
    expect(create.status).toBe(200)
    expect(invalidate).toHaveBeenCalledWith('/' + family)
    const article = await prisma.post.create({ data: {
      authorId: owner, title: 'Affected', content: 'Body', slug: 'post-' + slug, published: true,
      ...(kind === 'category' ? { categoryId: data.id } : { tags: { connect: { id: data.id } } }),
    } })
    const guide = await prisma.topicGuide.create({ data: { title: 'Related guide', slug: 'guide-' + slug, status: 'published', posts: { create: { postId: article.id } } } })
    guides.push(guide.id)
    invalidate.mockClear()
    const update = await routes.PATCH(request(family, 'PATCH', { id: data.id, name: 'Renamed', slug: slug + '-new' }))
    expect(update.status).toBe(200)
    for (const path of ['/' + family + '/' + slug, '/' + family + '/' + slug + '-new', '/posts/' + article.slug]) expect(invalidate).toHaveBeenCalledWith(path)
    expect(invalidate).not.toHaveBeenCalledWith('/posts/unrelated')
    expect(invalidate).toHaveBeenCalledWith('/guides/' + guide.slug)
    invalidate.mockClear()
    const deleted = await routes.DELETE(request(family + '?ids=' + data.id, 'DELETE'))
    expect(deleted.status).toBe(200)
    expect(invalidate).toHaveBeenCalledWith('/' + family + '/' + slug + '-new')
    expect(invalidate).toHaveBeenCalledWith('/posts/' + article.slug)
    expect(invalidate).toHaveBeenCalledWith('/guides/' + guide.slug)
  })
  test('does not invalidate when the database mutation fails', async () => {
    const slug = 'conflict-' + randomUUID()
    const first = await routes.POST(request(family, 'POST', { name: slug, slug }))
    ids[kind].push((await first.json()).data.id)
    invalidate.mockClear()
    expect((await routes.POST(request(family, 'POST', { name: slug + '-second', slug }))).status).toBe(409)
    expect(invalidate).not.toHaveBeenCalled()
  })
  test('reports cache failure without undoing a committed mutation', async () => {
    const slug = 'failure-' + randomUUID()
    invalidate.mockImplementation((path: string) => { if (path === '/' + family) throw new Error('injected cache failure') })
    const response = await routes.POST(request(family, 'POST', { name: slug, slug }))
    const body = await response.json(); ids[kind].push(body.data.id)
    expect(response.status).toBe(200)
    expect(body.cache.failedPaths).toEqual(['/' + family])
    expect(invalidate).toHaveBeenCalledWith('/' + family + '/' + slug)
  })
})
