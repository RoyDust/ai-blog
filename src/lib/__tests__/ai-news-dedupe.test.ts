import { describe, expect, test, vi } from "vitest"

import {
  canonicalizeAiNewsUrl,
  dedupeByCanonicalUrl,
  semanticDedupeCandidates,
  type AiNewsDuplicateMap,
} from "@/lib/ai-news-dedupe"
import type { AiNewsCandidateInput, AiNewsRawItem } from "@/lib/ai-news-types"

function rawItem(overrides: Partial<AiNewsRawItem> = {}): AiNewsRawItem {
  return {
    id: overrides.id ?? "item-1",
    sourceId: overrides.sourceId ?? "source-1",
    sourceType: overrides.sourceType ?? "RSS",
    sourceName: overrides.sourceName ?? "Source 1",
    title: overrides.title ?? "AI release",
    url: overrides.url ?? "https://example.com/news/ai-release",
    summary: overrides.summary ?? "Short summary",
    content: overrides.content ?? null,
    author: overrides.author ?? null,
    publishedAt: overrides.publishedAt ?? new Date("2026-05-06T00:00:00Z"),
    metadata: overrides.metadata ?? null,
    community: overrides.community ?? null,
    canonicalUrl: overrides.canonicalUrl,
  }
}

function candidate(overrides: Partial<AiNewsCandidateInput> = {}): AiNewsCandidateInput {
  const item = rawItem(overrides)

  return {
    ...item,
    canonicalUrl: overrides.canonicalUrl ?? canonicalizeAiNewsUrl(item.url),
    duplicateOfId: overrides.duplicateOfId ?? null,
    mergedSources: overrides.mergedSources ?? [
      {
        sourceId: item.sourceId,
        sourceType: item.sourceType,
        sourceName: item.sourceName,
        url: item.url,
      },
    ],
  }
}

function aiResponse(content: unknown, ok = true) {
  return {
    ok,
    json: async () =>
      typeof content === "string"
        ? {
            choices: [{ message: { content } }],
          }
        : content,
  } as Response
}

function expectDuplicateMap(actual: AiNewsDuplicateMap, expected: AiNewsDuplicateMap) {
  expect(actual).toEqual(expected)
}

describe("canonicalizeAiNewsUrl", () => {
  test("normalizes common URL variants", () => {
    expect(canonicalizeAiNewsUrl("https://www.example.com/path/?b=2&utm_source=rss&a=1#comments")).toBe(
      "https://example.com/path?a=1&b=2",
    )
  })

  test("uses a stable fallback for invalid URLs", () => {
    expect(canonicalizeAiNewsUrl("not a url/?utm_campaign=x&b=2&a=1#hash")).toBe("not a url?a=1&b=2")
  })
})

describe("dedupeByCanonicalUrl", () => {
  test("merges the same URL across sources and keeps the richer item as primary", () => {
    const items = [
      rawItem({
        id: "rss-short",
        sourceId: "rss",
        sourceType: "RSS",
        sourceName: "RSS Source",
        url: "https://www.example.com/news/model-x?utm_source=rss#comments",
        summary: "Short",
        metadata: { discussionUrl: "https://example.com/discuss/rss" },
        community: { comments: ["rss comment"] },
      }),
      rawItem({
        id: "hn-rich",
        sourceId: "hn",
        sourceType: "HACKERNEWS",
        sourceName: "Hacker News",
        url: "https://example.com/news/model-x/",
        summary: "A much longer summary with more details about the announcement.",
        content: "Long form body with enough context to become the primary candidate.",
        metadata: { hnId: 123, discussionUrl: "https://news.ycombinator.com/item?id=123" },
        community: { topComments: ["useful context"] },
      }),
    ]

    const deduped = dedupeByCanonicalUrl(items)

    expect(deduped).toHaveLength(1)
    expect(deduped[0]).toMatchObject({
      id: "hn-rich",
      canonicalUrl: "https://example.com/news/model-x",
      sourceType: "HACKERNEWS",
      metadata: {
        hnId: 123,
        discussionUrl: "https://news.ycombinator.com/item?id=123",
      },
      community: {
        comments: ["rss comment"],
        topComments: ["useful context"],
      },
    })
    expect(deduped[0].mergedSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: "rss", sourceType: "RSS", sourceName: "RSS Source" }),
        expect.objectContaining({ sourceId: "hn", sourceType: "HACKERNEWS", sourceName: "Hacker News" }),
      ]),
    )
  })

  test("does not merge different events about the same product when URLs differ", () => {
    const deduped = dedupeByCanonicalUrl([
      rawItem({
        id: "launch",
        title: "Model X launches",
        url: "https://example.com/model-x-launch",
      }),
      rawItem({
        id: "benchmark",
        title: "Model X benchmark update",
        url: "https://example.com/model-x-benchmark-update",
      }),
    ])

    expect(deduped.map((item) => item.id)).toEqual(["launch", "benchmark"])
  })
})

describe("semanticDedupeCandidates", () => {
  const aiModel = {
    baseUrl: "https://ai.example.test/v1",
    requestPath: "/chat/completions",
    model: "dedupe-model",
    apiKey: "test-key",
  }

  test("ignores invalid AI duplicate groups", async () => {
    const candidates = [
      candidate({ id: "same-event-primary", title: "Model X launches", url: "https://example.com/model-x-launch" }),
      candidate({ id: "same-event-copy", title: "Model X launch mirror", url: "https://mirror.example.com/model-x-launch" }),
      candidate({ id: "different-event", title: "Model X benchmark update", url: "https://example.com/model-x-benchmark" }),
    ]
    const fetchImpl = vi.fn(async () =>
      aiResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                duplicateGroups: [
                  { primaryId: "same-event-primary", duplicateIds: ["same-event-copy"] },
                  { primaryId: "same-event-primary", duplicateIds: ["different-event"] },
                  { primaryId: "missing-primary", duplicateIds: ["different-event"] },
                  { primaryId: "different-event", duplicateIds: ["unknown-id"] },
                ],
              }),
            },
          },
        ],
      }),
    )

    const duplicateMap = await semanticDedupeCandidates({ candidates, aiModel, fetchImpl })

    expectDuplicateMap(duplicateMap, {
      "same-event-primary": ["same-event-copy"],
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  test("keeps same product but different event candidates when AI is conservative", async () => {
    const candidates = [
      candidate({ id: "launch", title: "Model X launches", url: "https://example.com/model-x-launch" }),
      candidate({ id: "benchmark", title: "Model X benchmark update", url: "https://example.com/model-x-benchmark" }),
    ]
    const fetchImpl = vi.fn(async () => aiResponse('{"duplicateGroups":[]}'))

    const duplicateMap = await semanticDedupeCandidates({ candidates, aiModel, fetchImpl })
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string | URL | Request, RequestInit]
    const requestBody = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> }

    expectDuplicateMap(duplicateMap, {})
    expect(requestBody.messages[1]?.content).toContain("When uncertain, keep both candidates")
  })

  test("accepts equivalent AI duplicate map structures", async () => {
    const candidates = [
      candidate({ id: "primary", title: "Model X launches", url: "https://example.com/model-x-launch" }),
      candidate({ id: "duplicate", title: "Model X launch mirror", url: "https://mirror.example.com/model-x-launch" }),
    ]
    const fetchImpl = vi.fn(async () => aiResponse('{"duplicateMap":{"primary":["duplicate"]}}'))

    const duplicateMap = await semanticDedupeCandidates({ candidates, aiModel, fetchImpl })

    expectDuplicateMap(duplicateMap, {
      primary: ["duplicate"],
    })
  })

  test("falls back to URL duplicate results when AI call fails", async () => {
    const candidates = [
      candidate({
        id: "primary",
        url: "https://www.example.com/news/model-x?utm_source=rss",
        summary: "Longer summary that should become URL fallback primary.",
      }),
      candidate({
        id: "duplicate",
        url: "https://example.com/news/model-x/",
        summary: "Short",
      }),
      candidate({
        id: "unrelated",
        url: "https://example.com/news/model-y",
      }),
    ]
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down")
    })

    const duplicateMap = await semanticDedupeCandidates({ candidates, aiModel, fetchImpl })

    expectDuplicateMap(duplicateMap, {
      primary: ["duplicate"],
    })
  })
})
