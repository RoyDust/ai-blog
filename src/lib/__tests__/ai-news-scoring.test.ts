import { describe, expect, test, vi } from "vitest"

import {
  parseAiNewsScoreResponse,
  scoreAiNewsCandidate,
  selectScoredCandidates,
} from "@/lib/ai-news-scoring"
import type { AiNewsCandidateInput, AiNewsScoredCandidate, AiNewsSourceType } from "@/lib/ai-news-types"

function candidate(overrides: Partial<AiNewsCandidateInput> = {}): AiNewsCandidateInput {
  return {
    id: overrides.id ?? "candidate-1",
    sourceId: overrides.sourceId ?? "source-1",
    sourceType: overrides.sourceType ?? "RSS",
    sourceName: overrides.sourceName ?? "RSS",
    title: overrides.title ?? "OpenAI ships a model update",
    url: overrides.url ?? "https://example.com/openai",
    canonicalUrl: overrides.canonicalUrl ?? overrides.url ?? "https://example.com/openai",
    summary: overrides.summary ?? "A notable AI release.",
    content: overrides.content ?? "Release notes and benchmark details.",
    author: overrides.author ?? null,
    publishedAt: overrides.publishedAt ?? new Date("2026-05-06T00:00:00.000Z"),
    metadata: overrides.metadata ?? null,
    community: overrides.community ?? null,
    duplicateOfId: overrides.duplicateOfId ?? null,
    mergedSources: overrides.mergedSources,
  }
}

function scored({
  id,
  sourceType = "RSS",
  aiScore,
  aiRiskFlags = [],
}: {
  id: string
  sourceType?: AiNewsSourceType
  aiScore: number
  aiRiskFlags?: string[]
}): AiNewsScoredCandidate {
  return {
    ...candidate({ id, sourceType, sourceName: sourceType, url: `https://example.com/${id}` }),
    aiScore,
    aiReason: `reason ${id}`,
    aiSummary: `summary ${id}`,
    aiTags: ["ai"],
    aiRiskFlags,
    scoreError: null,
  }
}

describe("parseAiNewsScoreResponse", () => {
  test("parses plain JSON", () => {
    expect(parseAiNewsScoreResponse('{"score":8,"reason":"strong","summary":"summary","tags":["model"],"riskFlags":[]}')).toEqual({
      score: 8,
      reason: "strong",
      summary: "summary",
      tags: ["model"],
      riskFlags: [],
    })
  })

  test("parses fenced JSON", () => {
    expect(parseAiNewsScoreResponse('```json\n{"score":7,"reason":"ok","summary":"s","tags":["tool"],"riskFlags":[]}\n```')).toMatchObject({
      score: 7,
      reason: "ok",
      tags: ["tool"],
    })
  })

  test("extracts JSON from surrounding text", () => {
    expect(parseAiNewsScoreResponse('Here is the score: {"score":9,"reason":"important","summary":"s","tags":["research"],"riskFlags":[]} Thanks.')).toMatchObject({
      score: 9,
      reason: "important",
      tags: ["research"],
    })
  })

  test("returns structured error for invalid JSON", () => {
    expect(parseAiNewsScoreResponse("not json")).toMatchObject({
      score: 0,
      reason: "AI score response was not valid JSON",
      summary: "",
      tags: [],
      riskFlags: [],
      error: "AI score response was not valid JSON",
    })
  })
})

describe("scoreAiNewsCandidate", () => {
  test("sends OpenAI-compatible chat completion payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{
        message: {
          content: '{"score":8,"reason":"useful","summary":"s","tags":["release"],"riskFlags":[]}',
        },
      }],
    }), { status: 200 }))

    const result = await scoreAiNewsCandidate({
      candidate: candidate(),
      aiModel: {
        baseUrl: "https://models.example.com/v1/",
        requestPath: "/chat/completions",
        model: "scorer",
        apiKey: "secret",
      },
      fetchImpl,
    })

    expect(result).toMatchObject({ score: 8, reason: "useful", tags: ["release"] })
    expect(fetchImpl).toHaveBeenCalledWith("https://models.example.com/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    }))
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "scorer",
      temperature: 0.2,
      messages: expect.arrayContaining([
        expect.objectContaining({ role: "user", content: expect.stringContaining("score/reason/summary/tags/riskFlags") }),
        expect.objectContaining({ role: "user", content: expect.stringContaining("Simplified Chinese") }),
      ]),
    })
  })

  test("returns score zero on upstream 500 without throwing", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: "temporary outage" },
    }), { status: 500 }))

    await expect(scoreAiNewsCandidate({
      candidate: candidate(),
      aiModel: {
        baseUrl: "https://models.example.com/v1",
        requestPath: "/chat/completions",
        model: "scorer",
      },
      fetchImpl,
    })).resolves.toMatchObject({
      score: 0,
      reason: "temporary outage",
      error: "temporary outage",
    })
  })
})

describe("selectScoredCandidates", () => {
  test("filters below threshold and sorts selected candidates by score", () => {
    const result = selectScoredCandidates({
      candidates: [
        scored({ id: "low", aiScore: 6 }),
        scored({ id: "high", aiScore: 9 }),
        scored({ id: "mid", aiScore: 8, sourceType: "HACKERNEWS" }),
      ],
      threshold: 7,
      maxSelected: 3,
    })

    expect(result.selected.map((item) => item.id)).toEqual(["high", "mid"])
    expect(result.rejected.map((item) => item.id)).toContain("low")
    expect(result.rejected.find((item) => item.id === "low")).toMatchObject({ selected: false })
  })

  test("limits default source diversity to about half of max selected", () => {
    const result = selectScoredCandidates({
      candidates: [
        scored({ id: "rss-1", aiScore: 10 }),
        scored({ id: "rss-2", aiScore: 9.8 }),
        scored({ id: "rss-3", aiScore: 9.6 }),
        scored({ id: "hn-1", sourceType: "HACKERNEWS", aiScore: 9 }),
      ],
      threshold: 7,
      maxSelected: 4,
    })

    expect(result.selected.map((item) => item.id)).toEqual(["rss-1", "rss-2", "hn-1"])
    expect(result.rejected.find((item) => item.id === "rss-3")?.selectionReason).toContain("Source diversity")
  })

  test("excludes severe risk flags and downranks low-signal candidates", () => {
    const result = selectScoredCandidates({
      candidates: [
        scored({ id: "hallucination", aiScore: 10, sourceType: "RSS", aiRiskFlags: ["hallucination"] }),
        scored({ id: "duplicate", aiScore: 9.5, sourceType: "HACKERNEWS", aiRiskFlags: ["duplicate"] }),
        scored({ id: "low-signal", aiScore: 8, sourceType: "GITHUB_RELEASES", aiRiskFlags: ["low-signal"] }),
        scored({ id: "clean", aiScore: 7.5, sourceType: "REDDIT" }),
      ],
      threshold: 7,
      maxSelected: 4,
    })

    expect(result.selected.map((item) => item.id)).toEqual(["clean"])
    expect(result.rejected.find((item) => item.id === "hallucination")?.selectionReason).toContain("risk flags")
    expect(result.rejected.find((item) => item.id === "duplicate")?.selectionReason).toContain("risk flags")
    expect(result.rejected.find((item) => item.id === "low-signal")?.selectionReason).toContain("Below selection threshold")
  })
})
