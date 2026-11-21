import { readFileSync } from "node:fs"
import { describe, expect, test } from "vitest"

describe("daily AI news workflow", () => {
  test("schedules the protected cron endpoint with production secrets and polls by persisted runId", () => {
    const workflow = readFileSync(".github/workflows/daily-ai-news.yml", "utf8")

    expect(workflow).toContain("cron:")
    expect(workflow).toContain("concurrency:")
    expect(workflow).toContain("group: cron-daily-ai-news")
    expect(workflow).toContain("PRODUCTION_BASE_URL must start with https://")
    expect(workflow).toContain("--proto '=https' --tlsv1.2 --max-time 30")
    expect(workflow).toContain("api/cron/ai-news")
    expect(workflow).toContain("regenerate:")
    expect(workflow).toContain("regenerate=true")
    expect(workflow).toContain("INPUT_REGENERATE")
    expect(workflow).toContain("Missing runId in daily AI news trigger response")
    expect(workflow).toContain("Polling daily AI news status")
    expect(workflow).toContain("runId=${encoded_run_id}")
    expect(workflow).not.toContain("after=${status_after}")
    expect(workflow).toContain("secrets.PRODUCTION_BASE_URL")
    expect(workflow).toContain("secrets.AI_NEWS_CRON_SECRET")
    expect(workflow).toContain("Authorization: Bearer")
  })
})
