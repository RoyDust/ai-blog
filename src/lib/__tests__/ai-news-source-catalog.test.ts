import { readFileSync } from "node:fs"

import { describe, expect, test } from "vitest"

import { FALLBACK_DAILY_AI_NEWS_SOURCES } from "@/lib/ai-news/sources"

const RADAR_RSS_SOURCES = [
  ["google-deepmind", "https://deepmind.google/blog/rss.xml"],
  ["aws-machine-learning", "https://aws.amazon.com/blogs/machine-learning/feed/"],
  ["bair-blog", "https://bair.berkeley.edu/blog/feed.xml"],
  ["mit-ai-news", "https://news.mit.edu/rss/topic/machine-learning"],
  ["simon-willison", "https://simonwillison.net/atom/everything/"],
  ["latent-space", "https://www.latent.space/feed"],
  ["infoq-ai-ml", "https://feed.infoq.com/ai-ml-data-eng"],
] as const

describe("AI news source catalog", () => {
  test("keeps the current radar RSS sources in the database fallback catalog", () => {
    for (const [id, url] of RADAR_RSS_SOURCES) {
      expect(FALLBACK_DAILY_AI_NEWS_SOURCES).toContainEqual(
        expect.objectContaining({ id, type: "RSS", url, enabled: true }),
      )
    }
    expect(FALLBACK_DAILY_AI_NEWS_SOURCES).toContainEqual(
      expect.objectContaining({ id: "venturebeat-ai", url: "https://venturebeat.com/feed/" }),
    )
    expect(FALLBACK_DAILY_AI_NEWS_SOURCES).toContainEqual(
      expect.objectContaining({ id: "hugging-face", url: "https://huggingface.co/blog/feed.xml", enabled: false }),
    )
  })

  test("seeds current radar sources for existing deployments without overwriting admin changes", () => {
    const migration = readFileSync(
      "prisma/migrations/202608080001_add_ai_news_radar_sources/migration.sql",
      "utf8",
    )

    for (const [id, url] of RADAR_RSS_SOURCES) {
      expect(migration).toContain(`('${id}', 'RSS'`)
      expect(migration).toContain(url)
    }
    expect(migration).toContain("('github-ollama', 'GITHUB_RELEASES'")
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING')
    expect(migration).toContain('"url" = \'https://venturebeat.com/feed/\'')
    expect(migration).toContain('"url" = \'https://venturebeat.com/category/ai/feed/\'')
    expect(migration).toContain('"id" = \'hugging-face\'')
    expect(migration).toContain('"updatedAt" = "createdAt"')
  })
})
