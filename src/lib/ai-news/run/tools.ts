/**
 * run 编排的共享小工具。
 *
 * 与业务步骤分离的通用转换器与辅助函数：
 * 并发控制、错误消息读取、候选记录转换、fact-card 匹配、指标序列化等。
 * 只做纯转换，不引用数据库与网络。
 */
import type { AiNewsCandidateRecord } from "@/lib/ai-news/candidates"
import type { AiNewsEnrichedFactCard } from "@/lib/ai-news/enrichment"
import type { AiNewsItem } from "@/lib/ai-news/parser"
import type { AiNewsRunTriggerInput } from "@/lib/ai-news/run/config"
import type {
  AiNewsCandidateInput,
  AiNewsJsonObject,
  AiNewsRawItem,
  AiNewsScoredCandidate,
  AiNewsSourceFailure,
} from "@/lib/ai-news/types"

export function normalizeRunTrigger(trigger: AiNewsRunTriggerInput) {
  return trigger === "cron" ? "CRON" : "MANUAL"
}

export function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Daily AI news generation failed"
}

export function isPlainObject(value: unknown): value is AiNewsJsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

export function jsonObjectOrNull(value: unknown): AiNewsJsonObject | null {
  return isPlainObject(value) ? value : null
}

export function candidateRecordToInput(record: AiNewsCandidateRecord): AiNewsCandidateInput {
  return {
    id: record.id,
    sourceId: record.sourceId,
    sourceType: record.sourceType,
    sourceName: record.sourceName,
    title: record.title,
    url: record.url,
    canonicalUrl: record.canonicalUrl,
    summary: record.summary,
    content: record.content,
    author: record.author,
    publishedAt: record.publishedAt,
    metadata: jsonObjectOrNull(record.metadata),
    community: jsonObjectOrNull(record.community),
    duplicateOfId: record.duplicateOfId,
    enrichment: jsonObjectOrNull(record.enrichment),
  }
}

export function candidateToNewsItem(candidate: AiNewsCandidateInput | AiNewsScoredCandidate): AiNewsItem {
  const scored = candidate as Partial<AiNewsScoredCandidate>

  return {
    id: candidate.id,
    title: candidate.title,
    url: candidate.url,
    summary: scored.aiSummary || candidate.summary || candidate.content?.slice(0, 360) || "",
    sourceId: candidate.sourceId ?? candidate.sourceType.toLowerCase(),
    sourceName: candidate.sourceName,
    publishedAt: candidate.publishedAt ?? null,
  }
}

export function sortRawItemsByDate(items: AiNewsRawItem[]) {
  return [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
}

/**
 * Runs AI-heavy candidate work with bounded concurrency.
 * This protects local/serverless runtimes from starting one model request per candidate.
 */
export async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length)
  let nextIndex = 0
  const workerCount = Math.max(1, Math.min(concurrency, values.length))

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex
        nextIndex += 1
        results[index] = await mapper(values[index], index)
      }
    }),
  )

  return results
}

export function factCardToEnrichment(card: AiNewsEnrichedFactCard): AiNewsJsonObject {
  return JSON.parse(JSON.stringify(card)) as AiNewsJsonObject
}

export function normalizeFactCardLookupTitle(value: string) {
  return value.trim().toLowerCase()
}

export function normalizeFactCardLookupUrl(value: string | null | undefined) {
  return (value ?? "").trim().replace(/#.*$/, "").replace(/\/$/, "")
}

export function buildFactCardLookup(cards: AiNewsEnrichedFactCard[]) {
  const byTitle = new Map<string, AiNewsEnrichedFactCard>()
  const byUrl = new Map<string, AiNewsEnrichedFactCard>()

  for (const card of cards) {
    const titleKey = normalizeFactCardLookupTitle(card.title)
    if (titleKey && !byTitle.has(titleKey)) {
      byTitle.set(titleKey, card)
    }

    for (const citation of card.citations) {
      const urlKey = normalizeFactCardLookupUrl(citation.url)
      if (urlKey && !byUrl.has(urlKey)) {
        byUrl.set(urlKey, card)
      }
    }
  }

  return { byTitle, byUrl }
}

export function findFactCardForCandidate(
  lookup: ReturnType<typeof buildFactCardLookup>,
  candidate: AiNewsScoredCandidate,
) {
  return lookup.byTitle.get(normalizeFactCardLookupTitle(candidate.title)) ??
    lookup.byUrl.get(normalizeFactCardLookupUrl(candidate.canonicalUrl)) ??
    lookup.byUrl.get(normalizeFactCardLookupUrl(candidate.url)) ??
    null
}

export function serializeSourceFailures(failures: AiNewsSourceFailure[]) {
  return failures.length > 0 ? failures : null
}

export function toRunQualityScore(score: number | undefined) {
  if (!Number.isFinite(score)) return null
  return Math.round((score ?? 0) * 10)
}
