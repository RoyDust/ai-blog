import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("daily AI news workflow", () => {
  test("schedules the protected cron endpoint with production secrets", () => {
    const workflow = readFileSync(".github/workflows/daily-ai-news.yml", "utf8")

    expect(workflow).toContain("cron:")
    expect(workflow).toContain("api/cron/ai-news")
    expect(workflow).toContain("secrets.PRODUCTION_BASE_URL")
    expect(workflow).toContain("secrets.AI_NEWS_CRON_SECRET")
    expect(workflow).toContain("Authorization: Bearer")
  })
})
