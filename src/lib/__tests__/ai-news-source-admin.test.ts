import { describe, expect, test, vi } from "vitest"

import { createAiNewsSource, deleteAiNewsSource, listAiNewsSources, testAiNewsSource, toPublicAiNewsSource } from "@/lib/ai-news-source-admin"

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, { status: 200, ...init })
}

describe("ai news source admin", () => {
  test("lists sources with database pagination and global enabled source ids", async () => {
    const rows = [
      {
        id: "openai",
        type: "RSS",
        name: "OpenAI Blog",
        url: "https://example.com/openai.xml",
        homepage: null,
        category: "official",
        enabled: true,
        weight: 120,
        minScore: null,
        fetchLimit: null,
        config: null,
      },
    ]
    const findMany = vi.fn().mockImplementation(async (args) => {
      if (args?.select?.id) return [{ id: "openai" }, { id: "hackernews-top" }]
      return rows
    })
    const count = vi.fn().mockImplementation(async (args) => {
      return args?.where?.enabled ? 2 : 31
    })
    const client = {
      aiNewsSource: {
        findMany,
        count,
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }

    const result = await listAiNewsSources({
      page: 3,
      limit: 10,
      query: "openai",
      category: "official",
    }, client)

    expect(count).toHaveBeenCalledWith({
      where: {
        category: "official",
        OR: [
          { name: { contains: "openai", mode: "insensitive" } },
          { url: { contains: "openai", mode: "insensitive" } },
          { category: { contains: "openai", mode: "insensitive" } },
        ],
      },
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 20,
      take: 10,
      orderBy: [{ enabled: "desc" }, { weight: "desc" }, { name: "asc" }],
    }))
    expect(result.pagination).toEqual({ page: 3, limit: 10, total: 31, totalPages: 4 })
    expect(result.summary).toEqual({ enabledCount: 2, enabledSourceIds: ["openai", "hackernews-top"] })
    expect(result.sources).toHaveLength(1)
  })

  test("creates RSS sources with generated ids and rejects duplicate URLs", async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ id: "example-ai-blog" }).mockResolvedValueOnce(null)
    const findFirst = vi.fn().mockResolvedValueOnce(null)
    const create = vi.fn().mockImplementation(async ({ data }) => ({
      ...data,
      createdAt: new Date("2026-05-31T00:00:00Z"),
      updatedAt: new Date("2026-05-31T00:00:00Z"),
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
      lastFetchedItemCount: null,
    }))
    const client = {
      aiNewsSource: {
        findUnique,
        findFirst,
        create,
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }

    const source = await createAiNewsSource({
      type: "RSS",
      name: "Example AI Blog",
      url: "https://example.com/feed.xml",
      homepage: "https://example.com",
      category: "industry",
    }, client)

    expect(findUnique).toHaveBeenCalledWith({ where: { id: "example-ai-blog" } })
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "example-ai-blog-2" } })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: "example-ai-blog-2",
        type: "RSS",
        name: "Example AI Blog",
        url: "https://example.com/feed.xml",
        weight: 50,
      }),
    })
    expect(source).toMatchObject({ id: "example-ai-blog-2", settings: {}, deletable: true })

    findFirst.mockResolvedValueOnce({ id: "duplicate" })
    await expect(createAiNewsSource({ type: "RSS", name: "Duplicate", url: "https://example.com/feed.xml" }, client)).rejects.toThrow("already exists")
  })

  test("protects built-in seed sources from deletion", async () => {
    const client = {
      aiNewsSource: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: "openai",
          type: "RSS",
          name: "OpenAI Blog",
          url: "https://openai.com/news/rss.xml",
          homepage: null,
          category: "official",
          enabled: true,
          weight: 120,
          minScore: null,
          fetchLimit: null,
          config: null,
        }),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    }

    await expect(deleteAiNewsSource("openai", client)).rejects.toThrow("Built-in AI news sources cannot be deleted")
    expect(client.aiNewsSource.delete).not.toHaveBeenCalled()
  })

  test("tests disabled RSS sources and filters stale feed items before recording health", async () => {
    const source = {
      id: "disabled",
      type: "RSS",
      name: "Disabled RSS",
      url: "https://example.com/feed.xml",
      homepage: null,
      category: "industry",
      enabled: false,
      weight: 50,
      minScore: null,
      fetchLimit: null,
      config: null,
    }
    const update = vi.fn().mockResolvedValue({ ...source, enabled: false })
    const client = {
      aiNewsSource: {
        findUnique: vi.fn().mockResolvedValue(source),
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update,
        delete: vi.fn(),
      },
    }
    const fetchImpl = vi.fn().mockResolvedValue(
      textResponse(`<rss><channel>
        <item><title>Fresh item</title><link>https://example.com/fresh</link><pubDate>Sat, 30 May 2026 02:00:00 GMT</pubDate></item>
        <item><title>Old item</title><link>https://example.com/old</link><pubDate>Wed, 01 Jan 2025 02:00:00 GMT</pubDate></item>
      </channel></rss>`),
    ) as unknown as typeof fetch

    const result = await testAiNewsSource("disabled", {
      fetchImpl,
      now: new Date("2026-05-31T00:00:00Z"),
    }, client)

    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/feed.xml", expect.any(Object))
    expect(result).toMatchObject({
      status: "success",
      itemCount: 1,
      sampleItems: [{ title: "Fresh item", url: "https://example.com/fresh" }],
    })
    expect(update).toHaveBeenCalledWith({
      where: { id: "disabled" },
      data: expect.objectContaining({
        lastTestStatus: "success",
        lastFetchedItemCount: 1,
      }),
    })
  })

  test("maps public sources without exposing raw config", () => {
    const source = toPublicAiNewsSource({
      id: "github-vercel-ai",
      type: "GITHUB_RELEASES",
      name: "Vercel AI SDK Releases",
      url: "https://github.com/vercel/ai",
      homepage: null,
      category: "github-release",
      enabled: true,
      weight: 53,
      minScore: null,
      fetchLimit: 10,
      config: { owner: "vercel", repo: "ai", hidden: "internal" },
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
      lastFetchedItemCount: null,
    })

    expect(source).toMatchObject({
      settings: { owner: "vercel", repo: "ai" },
      deletable: false,
    })
    expect(source).not.toHaveProperty("config")
  })
})
