import { afterEach, describe, expect, test, vi } from "vitest"

import { fetchAiNewsRawItems, parseAiNewsFeed } from "@/lib/ai-news-fetchers"
import { FALLBACK_DAILY_AI_NEWS_SOURCES, loadDailyAiNewsSources, loadSelectedDailyAiNewsSources } from "@/lib/ai-news-sources"
import type { AiNewsSourceConfig } from "@/lib/ai-news-types"

function textResponse(body: string, init?: ResponseInit) {
  return new Response(body, { status: 200, ...init })
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  })
}

describe("AI news fetchers", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.clearAllMocks()
  })

  test("parses RSS and Atom feeds with canonical URLs compatible with legacy tracking cleanup", () => {
    const rssSource: AiNewsSourceConfig = { id: "rss", type: "RSS", name: "RSS Source", url: "https://example.com/rss.xml" }
    const atomSource: AiNewsSourceConfig = { id: "atom", type: "RSS", name: "Atom Source", url: "https://example.com/atom.xml" }
    const rss = `<?xml version="1.0"?><rss><channel><item><title>OpenAI 发布新模型</title><link>https://example.com/a?utm_source=x&amp;b=2</link><description><![CDATA[<p>模型能力更新</p>]]></description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`
    const atom = `<?xml version="1.0"?><feed><entry><title>Anthropic 发布研究</title><link href="https://example.com/b?gclid=1&amp;a=1"/><summary>研究摘要</summary><updated>2026-04-29T03:00:00Z</updated></entry></feed>`

    const items = [...parseAiNewsFeed(rss, rssSource), ...parseAiNewsFeed(atom, atomSource)]

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      id: "rss:https://example.com/a?b=2",
      title: "OpenAI 发布新模型",
      url: "https://example.com/a?utm_source=x&b=2",
      canonicalUrl: "https://example.com/a?b=2",
      summary: "模型能力更新",
      sourceType: "RSS",
    })
    expect(items[1]).toMatchObject({
      id: "atom:https://example.com/b?a=1",
      title: "Anthropic 发布研究",
      canonicalUrl: "https://example.com/b?a=1",
      publishedAt: new Date("2026-04-29T03:00:00Z"),
    })
  })

  test("decodes numeric HTML entities from feed titles", () => {
    const rssSource: AiNewsSourceConfig = { id: "rss", type: "RSS", name: "RSS Source", url: "https://example.com/rss.xml" }
    const rss = `<rss><channel><item><title>DeepSeek China&#039;s fund and Sarlin&#8217;s lab</title><link>https://example.com/a</link><description>摘要</description></item></channel></rss>`

    expect(parseAiNewsFeed(rss, rssSource)[0]?.title).toBe("DeepSeek China's fund and Sarlin’s lab")
  })

  test("fetches RSS and Atom sources through the batch API", async () => {
    const sources: AiNewsSourceConfig[] = [
      { id: "rss", type: "RSS", name: "RSS Source", url: "https://example.com/rss.xml" },
      { id: "atom", type: "RSS", name: "Atom Source", url: "https://example.com/atom.xml" },
    ]
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/rss.xml")) {
        return Promise.resolve(textResponse(`<rss><channel><item><title>RSS Item</title><link>https://example.com/rss-item</link><description>RSS summary</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`))
      }
      if (url.endsWith("/atom.xml")) {
        return Promise.resolve(textResponse(`<feed><entry><title>Atom Item</title><link href="https://example.com/atom-item"/><summary>Atom summary</summary><updated>2026-04-29T03:00:00Z</updated></entry></feed>`))
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`))
    }) as unknown as typeof fetch

    const result = await fetchAiNewsRawItems({ sources, since: new Date("2026-04-28T00:00:00Z"), fetchImpl })

    expect(result.failures).toEqual([])
    expect(result.items.map((item) => item.title)).toEqual(["RSS Item", "Atom Item"])
  })

  test("fetches Hacker News stories with score, since, discussion URL, and truncated comments", async () => {
    const source: AiNewsSourceConfig = {
      id: "hn",
      type: "HACKERNEWS",
      name: "Hacker News",
      url: "https://news.ycombinator.com/",
      minScore: 50,
      fetchLimit: 3,
      config: { apiBase: "https://hn.test/v0", commentLimit: 1, commentTextMaxLength: 24 },
    }
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url === "https://hn.test/v0/topstories.json") return Promise.resolve(jsonResponse([101, 102, 103]))
      if (url === "https://hn.test/v0/item/101.json") {
        return Promise.resolve(jsonResponse({ id: 101, type: "story", by: "alice", title: "Useful AI Tool", url: "https://tool.example.com/?utm_campaign=x", score: 120, descendants: 7, time: 1777449600, kids: [201] }))
      }
      if (url === "https://hn.test/v0/item/102.json") {
        return Promise.resolve(jsonResponse({ id: 102, type: "story", by: "bob", title: "Low score", url: "https://low.example.com", score: 10, time: 1777449600 }))
      }
      if (url === "https://hn.test/v0/item/103.json") {
        return Promise.resolve(jsonResponse({ id: 103, type: "story", by: "carol", title: "Old story", url: "https://old.example.com", score: 80, time: 1714377600 }))
      }
      if (url === "https://hn.test/v0/item/201.json") {
        return Promise.resolve(jsonResponse({ id: 201, type: "comment", by: "dave", text: "<p>This is a useful comment with extra details that should be clipped.</p>" }))
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`))
    }) as unknown as typeof fetch

    const result = await fetchAiNewsRawItems({ sources: [source], since: new Date("2026-04-28T00:00:00Z"), fetchImpl })

    expect(result.failures).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: "hn:101",
      title: "Useful AI Tool",
      url: "https://tool.example.com/?utm_campaign=x",
      canonicalUrl: "https://tool.example.com",
      author: "alice",
      metadata: { hnId: 101, discussionUrl: "https://news.ycombinator.com/item?id=101" },
      community: {
        score: 120,
        commentCount: 7,
        discussionUrl: "https://news.ycombinator.com/item?id=101",
        comments: ["This is a useful comment"],
      },
    })
  })

  test("fetches GitHub releases from config and sends an optional token", async () => {
    process.env.GITHUB_TOKEN = "ghp_test"
    const source: AiNewsSourceConfig = {
      id: "gh",
      type: "GITHUB_RELEASES",
      name: "Next.js Releases",
      url: "https://github.com/vercel/next.js",
      fetchLimit: 2,
      config: { owner: "vercel", repo: "next.js" },
    }
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([
        {
          id: 1,
          html_url: "https://github.com/vercel/next.js/releases/tag/v16.1.6",
          tag_name: "v16.1.6",
          name: "v16.1.6",
          body: "Bug fixes and compiler updates",
          published_at: "2026-04-29T04:00:00Z",
          author: { login: "maintainer" },
        },
        {
          id: 2,
          html_url: "https://github.com/vercel/next.js/releases/tag/v15.0.0",
          tag_name: "v15.0.0",
          name: "v15.0.0",
          body: "Old release",
          published_at: "2025-04-29T04:00:00Z",
          author: { login: "maintainer" },
        },
      ]),
    ) as unknown as typeof fetch

    const result = await fetchAiNewsRawItems({ sources: [source], since: new Date("2026-04-28T00:00:00Z"), fetchImpl })

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.github.com/repos/vercel/next.js/releases?per_page=2",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer ghp_test", "User-Agent": "Inkforge-AiNews/1.0" }) }),
    )
    expect(result.failures).toEqual([])
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: "gh:1",
      title: "vercel/next.js v16.1.6",
      author: "maintainer",
      summary: "Bug fixes and compiler updates",
      metadata: { owner: "vercel", repo: "next.js", tag: "v16.1.6", releaseId: 1 },
    })
  })

  test("falls back to GitHub releases Atom feed when the API is rate limited", async () => {
    const source: AiNewsSourceConfig = {
      id: "gh",
      type: "GITHUB_RELEASES",
      name: "Vercel AI Releases",
      url: "https://github.com/vercel/ai",
      fetchLimit: 2,
      config: { owner: "vercel", repo: "ai" },
    }
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url === "https://api.github.com/repos/vercel/ai/releases?per_page=2") {
        return Promise.resolve(jsonResponse({ message: "rate limit" }, { status: 403 }))
      }
      if (url === "https://github.com/vercel/ai/releases.atom") {
        return Promise.resolve(textResponse(`<feed><entry><title>Release 6.0.0</title><link href="https://github.com/vercel/ai/releases/tag/v6.0.0"/><summary>AI SDK release notes</summary><updated>2026-04-29T04:00:00Z</updated></entry></feed>`))
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`))
    }) as unknown as typeof fetch

    const result = await fetchAiNewsRawItems({ sources: [source], since: new Date("2026-04-28T00:00:00Z"), fetchImpl })

    expect(result.failures).toEqual([])
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://github.com/vercel/ai/releases.atom",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: expect.stringContaining("application/atom+xml") }) }),
    )
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      title: "Release 6.0.0",
      url: "https://github.com/vercel/ai/releases/tag/v6.0.0",
      sourceType: "GITHUB_RELEASES",
    })
  })

  test("continues when one source fails and reports the source failure", async () => {
    const sources: AiNewsSourceConfig[] = [
      { id: "good", type: "RSS", name: "Good", url: "https://example.com/good.xml" },
      { id: "bad", type: "RSS", name: "Bad", url: "https://example.com/bad.xml" },
    ]
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith("/good.xml")) {
        return Promise.resolve(textResponse(`<rss><channel><item><title>Good Item</title><link>https://example.com/good</link><description>Good</description></item></channel></rss>`))
      }
      return Promise.resolve(textResponse("broken", { status: 503 }))
    }) as unknown as typeof fetch

    const result = await fetchAiNewsRawItems({ sources, since: new Date("2026-04-28T00:00:00Z"), fetchImpl })

    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe("Good Item")
    expect(result.failures).toEqual([
      expect.objectContaining({
        sourceId: "bad",
        sourceName: "Bad",
        sourceType: "RSS",
        stage: "fetch",
        message: "Bad HTTP 503",
      }),
    ])
  })

  test("loads enabled DB sources by priority and falls back when DB is unavailable, stale, or empty", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "z", type: "RSS", name: "Zeta", url: "https://example.com/z.xml", enabled: true, weight: 5, config: { team: "z" } },
      { id: "a", type: "HACKERNEWS", name: "Alpha", url: "https://news.ycombinator.com/", enabled: true, weight: 5, minScore: 40 },
      { id: "b", type: "RSS", name: "Beta", url: "https://example.com/b.xml", enabled: true, weight: 1 },
    ])

    const dbSources = await loadDailyAiNewsSources({ prisma: { aiNewsSource: { findMany } } })

    expect(findMany).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: [{ weight: "desc" }, { name: "asc" }],
    })
    expect(dbSources.map((source) => source.id)).toEqual(["a", "z", "b"])
    expect(dbSources[0]).toMatchObject({ type: "HACKERNEWS", minScore: 40 })

    await expect(loadDailyAiNewsSources({ prisma: { aiNewsSource: { findMany: vi.fn().mockResolvedValue([]) } } })).resolves.toEqual(FALLBACK_DAILY_AI_NEWS_SOURCES)
    await expect(loadDailyAiNewsSources({ prisma: {} })).resolves.toEqual(FALLBACK_DAILY_AI_NEWS_SOURCES)
    await expect(loadDailyAiNewsSources({ prisma: { aiNewsSource: { findMany: vi.fn().mockRejectedValue(new Error("stale client")) } } })).resolves.toEqual(FALLBACK_DAILY_AI_NEWS_SOURCES)
  })

  test("loads selected sources without enabled filtering or fallback", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: "disabled", type: "RSS", name: "Disabled", url: "https://example.com/feed.xml", enabled: false, weight: 10 },
    ])

    const result = await loadSelectedDailyAiNewsSources({
      prisma: { aiNewsSource: { findMany } },
      sourceIds: ["disabled", "missing"],
    })

    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ["disabled", "missing"] } },
      orderBy: [{ weight: "desc" }, { name: "asc" }],
    })
    expect(result.sources).toEqual([
      expect.objectContaining({
        id: "disabled",
        enabled: true,
        defaultEnabled: false,
      }),
    ])
    expect(result.missingIds).toEqual(["missing"])

    await expect(loadSelectedDailyAiNewsSources({ prisma: { aiNewsSource: { findMany: vi.fn().mockResolvedValue([]) } }, sourceIds: ["missing"] })).resolves.toEqual({
      sources: [],
      missingIds: ["missing"],
    })
  })
})
