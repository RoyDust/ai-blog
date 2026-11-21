import { createRequire } from "node:module"
import { describe, expect, test } from "vitest"

const require = createRequire(import.meta.url)
const { seedMockPosts } = require("../../../scripts/seed-mock-posts.cjs") as {
  seedMockPosts: (prisma: unknown, catalog?: unknown[]) => Promise<Array<Record<string, unknown>>>
}

type FakePostRow = {
  id: string
  slug: string
  deletedAt: Date | null
  [key: string]: unknown
}

function buildFakePrisma({
  categories = [{ id: "cat-frontend", slug: "frontend", deletedAt: null as Date | null }],
  tags = [
    { id: "tag-react", slug: "react", deletedAt: null as Date | null },
    { id: "tag-nextjs", slug: "nextjs", deletedAt: null as Date | null },
  ],
  posts = [] as FakePostRow[],
} = {}) {
  const state = {
    posts: posts.map((post) => ({ ...post })),
  }
  const calls = {
    postFindFirst: [] as Array<{ where: { slug: string; deletedAt: null } }>,
    postUpdate: [] as Array<{ where: { id: string }; data: Record<string, unknown> }>,
    postCreate: [] as Array<{ data: Record<string, unknown> }>,
  }

  return {
    state,
    calls,
    user: {
      async findFirst() {
        return { id: "admin-1", name: "Admin", email: "admin@example.com" }
      },
    },
    category: {
      async findFirst(args: { where: { slug: string; deletedAt?: null } }) {
        const match = categories.find(
          (row) => row.slug === args.where.slug && (args.where.deletedAt === null ? row.deletedAt === null : true),
        )
        return match ? { id: match.id } : null
      },
      async findUnique() {
        throw new Error("category.findUnique on slug is not supported under partial unique index")
      },
    },
    tag: {
      async findMany(args: { where: { slug: { in: string[] }; deletedAt?: null } }) {
        const wanted = new Set(args.where.slug.in)
        return tags
          .filter((row) => wanted.has(row.slug) && (args.where.deletedAt === null ? row.deletedAt === null : true))
          .map((row) => ({ id: row.id, slug: row.slug }))
      },
    },
    post: {
      async findFirst(args: { where: { slug: string; deletedAt: null } }) {
        calls.postFindFirst.push(args)
        const match = state.posts.find((row) => row.slug === args.where.slug && row.deletedAt === null)
        return match ? { id: match.id } : null
      },
      async update(args: { where: { id: string }; data: Record<string, unknown> }) {
        calls.postUpdate.push(args)
        const index = state.posts.findIndex((row) => row.id === args.where.id)
        const updated = { ...state.posts[index], ...args.data, id: args.where.id } as FakePostRow
        state.posts[index] = updated
        return updated
      },
      async create(args: { data: Record<string, unknown> & { slug: string } }) {
        calls.postCreate.push(args)
        const created: FakePostRow = {
          ...args.data,
          id: `created-${state.posts.length + 1}`,
          deletedAt: null,
        }
        state.posts.push(created)
        return created
      },
      async upsert() {
        throw new Error("post.upsert on slug is not supported under partial unique index")
      },
    },
  }
}

const sampleCatalog = [
  {
    title: "第一篇示例文章",
    slug: "mock-post-one",
    coverImage: "https://example.com/1.png",
    viewCount: 100,
    excerpt: "摘要一",
    content: "# 正文一",
    categorySlug: "frontend",
    tagSlugs: ["react", "nextjs"],
    publishedAt: "2026-02-10T08:00:00.000Z",
  },
  {
    title: "第二篇示例文章",
    slug: "mock-post-two",
    coverImage: "https://example.com/2.png",
    viewCount: 200,
    excerpt: "摘要二",
    content: "# 正文二",
    categorySlug: "frontend",
    tagSlugs: ["react"],
    publishedAt: "2026-02-12T08:00:00.000Z",
  },
]

describe("scripts/seed-mock-posts.cjs", () => {
  test("seeds mock posts idempotently using active-row findFirst -> update/create without upsert", async () => {
    const prisma = buildFakePrisma()

    const firstRun = await seedMockPosts(prisma, sampleCatalog)
    const secondRun = await seedMockPosts(prisma, sampleCatalog)

    expect(firstRun).toHaveLength(2)
    expect(secondRun).toHaveLength(2)
    expect(prisma.calls.postCreate).toHaveLength(2)
    expect(prisma.calls.postUpdate).toHaveLength(2)
    expect(prisma.state.posts).toHaveLength(2)
  })

  test("ignores soft-deleted posts, categories, and tags with matching slugs", async () => {
    const prisma = buildFakePrisma({
      categories: [
        { id: "cat-deleted", slug: "frontend", deletedAt: new Date("2026-01-01T00:00:00Z") },
        { id: "cat-active", slug: "frontend", deletedAt: null },
      ],
      tags: [
        { id: "tag-deleted", slug: "react", deletedAt: new Date("2026-01-01T00:00:00Z") },
        { id: "tag-react", slug: "react", deletedAt: null },
        { id: "tag-nextjs", slug: "nextjs", deletedAt: null },
      ],
      posts: [{ id: "post-deleted", slug: "mock-post-one", deletedAt: new Date("2026-01-02T00:00:00Z") }],
    })

    const results = await seedMockPosts(prisma, sampleCatalog.slice(0, 1))

    expect(prisma.calls.postUpdate).toHaveLength(0)
    expect(prisma.calls.postCreate).toHaveLength(1)
    expect(results[0]).toMatchObject({
      slug: "mock-post-one",
      categoryId: "cat-active",
      tags: {
        connect: [{ id: "tag-react" }, { id: "tag-nextjs" }],
      },
    })
    expect(prisma.state.posts).toHaveLength(2)
  })

  test("rejects when only a soft-deleted category exists for categorySlug", async () => {
    const prisma = buildFakePrisma({
      categories: [{ id: "cat-deleted", slug: "frontend", deletedAt: new Date("2026-01-01T00:00:00Z") }],
    })

    await expect(seedMockPosts(prisma, sampleCatalog.slice(0, 1))).rejects.toThrow("Category not found: frontend")
  })
})
