import { beforeEach, describe, expect, test, vi } from "vitest"

import {
  listAiNewsRunCandidates,
  markAiNewsCandidateDuplicates,
  markSelectedAiNewsCandidates,
  persistAiNewsCandidates,
  updateAiNewsCandidateEnrichments,
  updateAiNewsCandidateScores,
  type AiNewsCandidateRepository,
} from "@/lib/ai-news-candidates"

const create = vi.fn()
const update = vi.fn()
const updateMany = vi.fn()
const findMany = vi.fn()

const prisma = {
  aiNewsCandidate: {
    create,
    update,
    updateMany,
    findMany,
  },
} as unknown as AiNewsCandidateRepository

function candidateRecord(id: string) {
  return {
    id,
    runId: "run-1",
    sourceId: null,
    sourceType: "RSS" as const,
    sourceName: "Source",
    title: `Title ${id}`,
    url: `https://example.com/${id}`,
    canonicalUrl: `https://example.com/${id}`,
    summary: null,
    content: null,
    author: null,
    publishedAt: null,
    metadata: null,
    community: null,
    aiScore: null,
    aiReason: null,
    aiSummary: null,
    aiTags: [],
    aiRiskFlags: [],
    scoreError: null,
    duplicateOfId: null,
    selected: false,
    selectionReason: null,
    enrichment: null,
  }
}

describe("ai news candidate repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns empty arrays without writes for empty batches", async () => {
    await expect(persistAiNewsCandidates({ prisma, runId: "run-1", candidates: [] })).resolves.toEqual([])
    await expect(updateAiNewsCandidateScores({ prisma, scores: [] })).resolves.toEqual({ updated: [], failures: [] })

    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  test("maps candidate fields and JSON payloads into create data", async () => {
    const publishedAt = new Date("2026-05-06T01:02:03.000Z")
    create.mockResolvedValueOnce(candidateRecord("candidate-1"))

    await persistAiNewsCandidates({
      prisma,
      runId: "run-1",
      candidates: [
        {
          id: "raw-1",
          sourceId: "source-1",
          sourceType: "HACKERNEWS",
          sourceName: "HN",
          title: "Model release",
          url: "https://news.ycombinator.com/item?id=1",
          canonicalUrl: "https://example.com/model-release",
          summary: "Short summary",
          content: "Full content",
          author: "alice",
          publishedAt,
          metadata: { points: 50, nested: { keep: true, drop: undefined } },
          community: { comments: ["one", undefined, "three"] },
          duplicateOfId: "candidate-root",
          mergedSources: [
            {
              sourceId: "source-2",
              sourceType: "RSS",
              sourceName: "RSS",
              url: "https://example.com/rss",
            },
          ],
          enrichment: { provider: "lead", rank: 1 },
        },
      ],
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        runId: "run-1",
        sourceId: "source-1",
        sourceType: "HACKERNEWS",
        sourceName: "HN",
        title: "Model release",
        url: "https://news.ycombinator.com/item?id=1",
        canonicalUrl: "https://example.com/model-release",
        summary: "Short summary",
        content: "Full content",
        author: "alice",
        publishedAt,
        metadata: { points: 50, nested: { keep: true } },
        community: { comments: ["one", null, "three"] },
        duplicateOfId: "candidate-root",
        enrichment: { provider: "lead", rank: 1 },
      },
    })
  })

  test("throws contextual error when one candidate cannot be persisted", async () => {
    create.mockRejectedValueOnce(new Error("database unavailable"))

    await expect(
      persistAiNewsCandidates({
        prisma,
        runId: "run-1",
        candidates: [
          {
            id: "raw-1",
            sourceType: "RSS",
            sourceName: "RSS",
            title: "Broken item",
            url: "https://example.com/broken",
            canonicalUrl: "https://example.com/broken",
          },
        ],
      }),
    ).rejects.toThrow("Failed to persist AI news candidate at index 0 (Broken item): database unavailable")
  })

  test("continues score updates after local failures", async () => {
    update
      .mockResolvedValueOnce({ ...candidateRecord("candidate-1"), aiScore: 92 })
      .mockRejectedValueOnce(new Error("missing candidate"))
      .mockResolvedValueOnce({ ...candidateRecord("candidate-3"), aiScore: null, scoreError: "no signal" })

    const result = await updateAiNewsCandidateScores({
      prisma,
      scores: [
        {
          id: "candidate-1",
          aiScore: 92,
          aiReason: "Strong",
          aiSummary: "Important update",
          aiTags: ["model"],
          aiRiskFlags: [],
        },
        { id: "candidate-2", aiScore: 30, aiTags: [], aiRiskFlags: ["rumor"] },
        { id: "candidate-3", scoreError: "no signal" },
      ],
    })

    expect(result.updated.map((candidate) => candidate.id)).toEqual(["candidate-1", "candidate-3"])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatchObject({ id: "candidate-2" })
    expect(update).toHaveBeenCalledTimes(3)
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "candidate-1" },
      data: {
        aiScore: 92,
        aiReason: "Strong",
        aiSummary: "Important update",
        aiTags: ["model"],
        aiRiskFlags: [],
        scoreError: null,
      },
    })
    expect(update).toHaveBeenNthCalledWith(3, {
      where: { id: "candidate-3" },
      data: {
        aiScore: null,
        aiReason: null,
        aiSummary: null,
        aiTags: [],
        aiRiskFlags: [],
        scoreError: "no signal",
      },
    })
  })

  test("clears run selection then marks selected candidates", async () => {
    updateMany.mockResolvedValueOnce({ count: 4 })
    update
      .mockResolvedValueOnce({ ...candidateRecord("candidate-1"), selected: true, selectionReason: "top score" })
      .mockResolvedValueOnce({ ...candidateRecord("candidate-2"), selected: true, selectionReason: null })

    const result = await markSelectedAiNewsCandidates({
      prisma,
      runId: "run-1",
      selected: [
        { id: "candidate-1", selectionReason: "top score" },
        { id: "candidate-2" },
      ],
    })

    expect(result.clearedCount).toBe(4)
    expect(result.selected.map((candidate) => candidate.id)).toEqual(["candidate-1", "candidate-2"])
    expect(updateMany).toHaveBeenCalledWith({
      where: { runId: "run-1" },
      data: { selected: false, selectionReason: null },
    })
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "candidate-1" },
      data: { selected: true, selectionReason: "top score" },
    })
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: "candidate-2" },
      data: { selected: true, selectionReason: null },
    })
  })

  test("marks semantic duplicate candidates without stopping on local failures", async () => {
    update
      .mockResolvedValueOnce({ ...candidateRecord("duplicate-1"), duplicateOfId: "primary-1" })
      .mockRejectedValueOnce(new Error("missing duplicate"))

    const result = await markAiNewsCandidateDuplicates({
      prisma,
      duplicates: [
        { id: "duplicate-1", duplicateOfId: "primary-1" },
        { id: "duplicate-2", duplicateOfId: "primary-1" },
      ],
    })

    expect(result.updated.map((candidate) => candidate.id)).toEqual(["duplicate-1"])
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0]).toMatchObject({ id: "duplicate-2" })
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "duplicate-1" },
      data: { duplicateOfId: "primary-1" },
    })
  })

  test("updates candidate enrichments without stopping on local failures", async () => {
    update
      .mockResolvedValueOnce({ ...candidateRecord("candidate-1"), enrichment: { citations: [{ url: "https://example.com/a" }] } })
      .mockRejectedValueOnce(new Error("missing enrichment target"))

    const result = await updateAiNewsCandidateEnrichments({
      prisma,
      enrichments: [
        { id: "candidate-1", enrichment: { citations: [{ url: "https://example.com/a" }] } },
        { id: "candidate-2", enrichment: null },
      ],
    })

    expect(result.updated.map((candidate) => candidate.id)).toEqual(["candidate-1"])
    expect(result.failures).toHaveLength(1)
    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: "candidate-1" },
      data: { enrichment: { citations: [{ url: "https://example.com/a" }] } },
    })
  })

  test("lists run candidates with expected filter and ordering", async () => {
    findMany.mockResolvedValueOnce([candidateRecord("candidate-1")])

    await expect(listAiNewsRunCandidates({ prisma, runId: "run-1", selectedOnly: true })).resolves.toHaveLength(1)

    expect(findMany).toHaveBeenCalledWith({
      where: { runId: "run-1", selected: true },
      orderBy: [{ selected: "desc" }, { aiScore: "desc" }, { publishedAt: "desc" }],
    })
  })
})
