import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import { DAILY_AI_NEWS_SOURCES, DEFAULT_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"

describe("ai news default sources", () => {
  test("keeps the merged fallback catalog: 16 entries with sources-side enabled states and ollama as GITHUB_RELEASES", () => {
    expect(DEFAULT_AI_NEWS_SOURCES).toHaveLength(16)

    const disabledIds = DEFAULT_AI_NEWS_SOURCES.filter((source) => source.enabled === false).map((source) => source.id)
    expect(disabledIds).toEqual(["anthropic", "meta-ai", "hugging-face"])

    expect(DEFAULT_AI_NEWS_SOURCES).toContainEqual(
      expect.objectContaining({
        id: "github-ollama",
        type: "GITHUB_RELEASES",
        weight: 0,
        fetchLimit: 5,
        config: { owner: "ollama", repo: "ollama" },
      }),
    )
  })

  test("derives the legacy AiNewsSource view from the typed catalog for old signatures", () => {
    expect(DAILY_AI_NEWS_SOURCES).toHaveLength(DEFAULT_AI_NEWS_SOURCES.length)
    DEFAULT_AI_NEWS_SOURCES.forEach((source, index) => {
      expect(DAILY_AI_NEWS_SOURCES[index]).toEqual({
        id: source.id,
        name: source.name,
        feedUrl: source.url,
        homepage: source.homepage,
      })
    })
  })

  test("run-flow no longer holds its own default source copy", () => {
    const runFlowSource = readFileSync("src/lib/ai-news/run-flow.ts", "utf8")
    expect(runFlowSource).not.toMatch(/const DAILY_AI_NEWS_SOURCES/)
  })
})
