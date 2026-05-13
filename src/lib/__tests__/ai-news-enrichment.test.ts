import { describe, expect, test, vi } from "vitest"

import {
  calculateCitationCoverage,
  generateFactCardForCandidate,
  validateFactCardCitations,
  type AiNewsEnrichedFactCard,
} from "@/lib/ai-news-enrichment"
import type { AiNewsCandidateInput } from "@/lib/ai-news-types"

function candidate(overrides: Partial<AiNewsCandidateInput> = {}): AiNewsCandidateInput {
  return {
    id: overrides.id ?? "candidate-1",
    sourceId: overrides.sourceId ?? "source-1",
    sourceType: overrides.sourceType ?? "RSS",
    sourceName: overrides.sourceName ?? "RSS",
    title: overrides.title ?? "OpenAI ships a model update",
    url: overrides.url ?? "https://example.com/openai",
    canonicalUrl: overrides.canonicalUrl ?? "https://example.com/openai-canonical",
    summary: overrides.summary ?? "A notable AI release.",
    content: overrides.content ?? "Release notes and benchmark details.",
    author: overrides.author ?? null,
    publishedAt: overrides.publishedAt ?? new Date("2026-05-06T00:00:00.000Z"),
    metadata: overrides.metadata ?? {
      discussionUrl: "https://news.ycombinator.com/item?id=1",
      homepage: "https://openai.com",
      sourceUrl: "https://example.com/source",
    },
    community: overrides.community ?? {
      discussionUrl: "https://reddit.com/r/openai/comments/1",
    },
    duplicateOfId: overrides.duplicateOfId ?? null,
    mergedSources: overrides.mergedSources ?? [{
      sourceId: "source-2",
      sourceType: "HACKERNEWS",
      sourceName: "Hacker News",
      url: "https://example.com/merged",
    }],
    enrichment: overrides.enrichment ?? null,
  }
}

function factCard(overrides: Partial<AiNewsEnrichedFactCard> = {}): AiNewsEnrichedFactCard {
  return {
    title: overrides.title ?? "OpenAI ships a model update",
    summary: overrides.summary ?? "A notable AI release.",
    whatHappened: overrides.whatHappened ?? "OpenAI shipped an update.",
    whyItMatters: overrides.whyItMatters ?? "It may affect AI developers.",
    keyDetails: overrides.keyDetails ?? ["Release details"],
    limitations: overrides.limitations ?? ["Needs independent confirmation"],
    communityDiscussion: overrides.communityDiscussion ?? "Developers are discussing the update.",
    citations: overrides.citations ?? [],
    confidence: overrides.confidence ?? "medium",
    warnings: overrides.warnings ?? [],
  }
}

const aiModel = {
  baseUrl: "https://models.example.com/v1/",
  requestPath: "/chat/completions",
  model: "fact-carder",
  apiKey: "secret",
}

function aiResponse(content: string, status = 200) {
  return new Response(JSON.stringify({
    choices: [{
      message: { content },
    }],
  }), { status })
}

describe("validateFactCardCitations", () => {
  test("keeps citations from the candidate whitelist", () => {
    const result = validateFactCardCitations(factCard({
      citations: [
        { title: "Primary", url: "https://example.com/openai" },
        { title: "Canonical", url: "https://example.com/openai-canonical" },
        { title: "Metadata discussion", url: "https://news.ycombinator.com/item?id=1" },
        { title: "Community discussion", url: "https://reddit.com/r/openai/comments/1" },
        { title: "Merged", url: "https://example.com/merged" },
        { title: "Homepage", url: "https://openai.com" },
        { title: "Source", url: "https://example.com/source" },
      ],
    }), candidate())

    expect(result.citations.map((citation) => citation.url)).toEqual([
      "https://example.com/openai",
      "https://example.com/openai-canonical",
      "https://news.ycombinator.com/item?id=1",
      "https://reddit.com/r/openai/comments/1",
      "https://example.com/merged",
      "https://openai.com",
      "https://example.com/source",
    ])
    expect(result.warnings).toEqual([])
  })

  test("drops unknown citation URLs and records a warning", () => {
    const result = validateFactCardCitations(factCard({
      citations: [
        { title: "Allowed", url: "https://example.com/openai" },
        { title: "Invented", url: "https://unknown.example.com/story" },
      ],
    }), candidate())

    expect(result.citations).toEqual([{ title: "Allowed", url: "https://example.com/openai", sourceName: "RSS" }])
    expect(result.warnings).toContain("Removed 1 citation with unknown citation URL.")
  })

  test("falls back to the candidate source URL when all model citations are outside the whitelist", () => {
    const result = validateFactCardCitations(factCard({
      citations: [
        { title: "Invented", url: "https://unknown.example.com/story?utm_source=x" },
      ],
    }), candidate())

    expect(result.citations).toEqual([{
      title: "RSS",
      url: "https://example.com/openai-canonical",
      sourceName: "RSS",
    }])
    expect(result.warnings).toContain("Removed 1 citation URL(s) outside the candidate whitelist; fell back to the candidate source URL.")
  })

  test("matches candidate citations after URL normalization", () => {
    const result = validateFactCardCitations(factCard({
      citations: [
        { title: "Canonical with tracking", url: "https://www.example.com/openai-canonical/?utm_campaign=x" },
      ],
    }), candidate())

    expect(result.citations).toEqual([{
      title: "Canonical with tracking",
      url: "https://example.com/openai-canonical",
      sourceName: "RSS",
    }])
    expect(result.warnings).toEqual([])
  })
})

describe("calculateCitationCoverage", () => {
  test("calculates cards with at least one citation divided by total cards", () => {
    expect(calculateCitationCoverage([
      factCard({ citations: [{ url: "https://example.com/a" }] }),
      factCard({ citations: [] }),
      factCard({ citations: [{ url: "https://example.com/b" }, { url: "https://example.com/c" }] }),
    ])).toBe(2 / 3)
  })

  test("returns zero for empty card lists", () => {
    expect(calculateCitationCoverage([])).toBe(0)
  })
})

describe("generateFactCardForCandidate", () => {
  test("requests an OpenAI-compatible fact card and validates citations", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(aiResponse(JSON.stringify({
      title: "OpenAI ships a model update",
      summary: "OpenAI shipped an update.",
      whatHappened: "OpenAI shipped an update.",
      whyItMatters: "Developers may need to adapt.",
      keyDetails: ["A new model is available"],
      limitations: ["Benchmarks need review"],
      communityDiscussion: "Developers are discussing the update.",
      citations: [
        { title: "Allowed", url: "https://example.com/openai" },
        { title: "Invented", url: "https://invented.example.com" },
      ],
      confidence: "high",
      warnings: [],
    })))

    const result = await generateFactCardForCandidate({
      candidate: candidate(),
      aiModel,
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith("https://models.example.com/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    }))
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "fact-carder",
      temperature: 0.2,
      max_tokens: 2200,
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.stringContaining("title/summary/whatHappened/whyItMatters") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("Simplified Chinese") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("whatHappened: 120-180 Chinese characters") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("Do not repeat the same sentence or idea") }),
      ]),
    })
    expect(result).toMatchObject({
      title: "OpenAI ships a model update",
      confidence: "high",
      citations: [{ title: "Allowed", url: "https://example.com/openai" }],
    })
    expect(result.warnings).toContain("Removed 1 citation with unknown citation URL.")
  })

  test("returns a conservative fallback card on upstream failure", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "temporary outage" },
    }), { status: 500 }))

    const result = await generateFactCardForCandidate({
      candidate: candidate(),
      aiModel,
      fetchImpl,
    })

    expect(result).toMatchObject({
      title: "OpenAI ships a model update",
      summary: "来自 RSS 的 AI 动态，详情以来源链接为准。",
      whyItMatters: "",
      keyDetails: [],
      confidence: "low",
      warnings: ["temporary outage"],
      citations: expect.arrayContaining([
        expect.objectContaining({ url: "https://example.com/openai-canonical" }),
      ]),
    })
  })

  test("returns a conservative fallback card on invalid JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(aiResponse("this is not json"))

    await expect(generateFactCardForCandidate({
      candidate: candidate(),
      aiModel,
      fetchImpl,
    })).resolves.toMatchObject({
      title: "OpenAI ships a model update",
      confidence: "low",
      warnings: ["AI fact card response was not valid JSON"],
    })
  })
})
