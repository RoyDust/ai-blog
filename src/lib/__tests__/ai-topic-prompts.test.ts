import { describe, expect, test } from "vitest"

describe("ai topic prompts", () => {
  test("builds a topic angle prompt with source constraints", async () => {
    const { buildTopicAnglePrompt } = await import("../ai-topic-prompts")
    const prompt = buildTopicAnglePrompt({
      topicTitle: "AI Agent 工程化",
      candidates: [{ title: "Agent SDK 发布", url: "https://example.com/a", summary: "SDK news" }],
    })

    expect(prompt).toContain("AI Agent 工程化")
    expect(prompt).toContain("https://example.com/a")
    expect(prompt).toContain("只基于候选来源")
  })
})
