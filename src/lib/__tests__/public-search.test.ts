import { beforeEach, describe, expect, test, vi } from "vitest"

const findMany = vi.fn()
const queryRaw = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany,
    },
    $queryRaw: queryRaw,
  },
}))

function flattenSqlStrings(callArg: unknown): string {
  if (Array.isArray(callArg)) {
    return callArg.join(" ")
  }
  if (callArg && typeof callArg === "object" && "strings" in callArg && Array.isArray((callArg as { strings: string[] }).strings)) {
    return (callArg as { strings: string[] }).strings.join(" ")
  }
  return String(callArg ?? "")
}

describe("searchPublicPosts", () => {
  beforeEach(() => {
    findMany.mockReset()
    queryRaw.mockReset()
  })

  test("filters soft-deleted categories and tags in SQL and hydrates via narrow select without Post.content", async () => {
    const longBodyPrefix = "A".repeat(300)
    queryRaw.mockResolvedValueOnce([
      {
        total: 1,
        items: [
          {
            id: "post-1",
            score: 16,
            hitFields: ["title", "content"],
            contentSnippet: longBodyPrefix,
          },
        ],
      },
    ])
    findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        title: "Prisma 查询裁剪",
        slug: "prisma-projection",
        excerpt: null,
        coverImage: null,
        featured: false,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        readingTimeMinutes: 5,
        viewCount: 18,
        author: { id: "u1", name: "Ada", image: null },
        category: { name: "数据库", slug: "database", deletedAt: new Date("2026-04-02T00:00:00.000Z") },
        tags: [
          { name: "ActiveTag", slug: "active-tag", deletedAt: null },
          { name: "DeletedTag", slug: "deleted-tag", deletedAt: new Date("2026-04-02T00:00:00.000Z") },
        ],
        _count: { comments: 2, likes: 3 },
      },
    ])

    const {
      PUBLIC_SEARCH_CONTENT_SNIPPET_MAX_LENGTH,
      PUBLIC_SEARCH_SNIPPET_MAX_LENGTH,
      searchPublicPosts,
    } = await import("../public-search")
    const result = await searchPublicPosts({ query: "Prisma", page: 1, limit: 10 })

    const sql = flattenSqlStrings(queryRaw.mock.calls[0]?.[0])
    expect(sql).toContain('LEFT JOIN "categories" c ON c."id" = p."categoryId" AND c."deletedAt" IS NULL')
    expect(sql).toContain('t."deletedAt" IS NULL')
    expect(sql).not.toContain("tag_candidate_hit")
    expect(sql).toContain('LEFT(p_snippet."content", 240)')

    const findManyArgs = findMany.mock.calls[0]?.[0]
    expect(findManyArgs.include).toBeUndefined()
    expect(findManyArgs.select).toBeDefined()
    expect(findManyArgs.select).not.toHaveProperty("content")
    expect(findManyArgs.select.category).toEqual({
      where: { deletedAt: null },
      select: { name: true, slug: true },
    })
    expect(findManyArgs.select.tags).toEqual({
      where: { deletedAt: null },
      select: { name: true, slug: true },
    })

    expect(result.total).toBe(1)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).not.toHaveProperty("content")
    expect(result.items[0]?.contentSnippet).toHaveLength(PUBLIC_SEARCH_CONTENT_SNIPPET_MAX_LENGTH)
    expect(result.items[0]?.snippet?.length).toBeLessThanOrEqual(PUBLIC_SEARCH_SNIPPET_MAX_LENGTH)
    expect(result.items[0]?.category).toBeNull()
    expect(result.items[0]?.tags).toEqual([{ name: "ActiveTag", slug: "active-tag" }])
  })

  test("strips markdown and HTML into a <=160 char plain-text snippet when excerpt is absent", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        total: 1,
        items: [
          {
            id: "post-md",
            score: 12,
            hitFields: ["content"],
            contentSnippet: "## 搜索导言\n\n这里介绍 **Prisma** 查询裁剪与 [站内检索](/search) 的 `LEFT(content, 240)` 方案，确保无摘要文章也能展示真实预览。",
          },
        ],
      },
    ])
    findMany.mockResolvedValueOnce([
      {
        id: "post-md",
        title: "无摘要搜索卡片",
        slug: "excerptless-card",
        excerpt: "   ",
        coverImage: null,
        featured: false,
        createdAt: new Date("2026-04-05T00:00:00.000Z"),
        author: { id: "u1", name: "Ada", image: null },
        category: null,
        tags: [],
        _count: { comments: 0, likes: 0 },
      },
    ])

    const { PUBLIC_SEARCH_SNIPPET_MAX_LENGTH, searchPublicPosts } = await import("../public-search")
    const result = await searchPublicPosts({ query: "Prisma", page: 1, limit: 10 })

    expect(result.items[0]?.snippet).toBe(
      "搜索导言 这里介绍 Prisma 查询裁剪与 站内检索 的 LEFT(content, 240) 方案，确保无摘要文章也能展示真实预览。",
    )
    expect(result.items[0]?.snippet?.length).toBeLessThanOrEqual(PUBLIC_SEARCH_SNIPPET_MAX_LENGTH)
  })
})
