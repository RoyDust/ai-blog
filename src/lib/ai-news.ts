/**
 * AI 日报聚合与发布主流程。
 *
 * 职责：
 * - 拉取多源 RSS / Atom 新闻
 * - 规范化、去重、筛选候选内容
 * - 调用模型生成日报草稿
 * - 记录运行状态、质量指标与来源失败信息
 * - 视配置把草稿创建为后台文章，必要时自动发布
 *
 * 说明：
 * - 这是“编排层”模块，真正的去重、评分、富化、渲染逻辑拆在子模块中
 * - 阅读时建议优先看 runDailyAiNews，再回溯上游候选抓取与草稿生成函数
 */
import { createAdminPost, publishAiDraftPost, updateAdminPost } from "@/lib/ai-authoring"
import { getAiModelChatRequestExtras, getAiModelForCapability, type AiModelOption } from "@/lib/ai-models"
import {
  markAiNewsCandidateDuplicates,
  markSelectedAiNewsCandidates,
  persistAiNewsCandidates,
  updateAiNewsCandidateEnrichments,
  updateAiNewsCandidateScores,
  type AiNewsCandidateRecord,
  type AiNewsCandidateRepository,
} from "@/lib/ai-news-candidates"
import { dedupeByCanonicalUrl, semanticDedupeCandidates, type AiNewsDuplicateMap } from "@/lib/ai-news-dedupe"
import { calculateCitationCoverage, generateFactCardForCandidate, type AiNewsEnrichedFactCard } from "@/lib/ai-news-enrichment"
import { fetchAiNewsRawItems } from "@/lib/ai-news-fetchers"
import { renderDailyAiNewsMarkdown } from "@/lib/ai-news-renderer"
import { loadDailyAiNewsSources } from "@/lib/ai-news-sources"
import { scoreAiNewsCandidate, selectScoredCandidates } from "@/lib/ai-news-scoring"
import type {
  AiNewsCandidateInput,
  AiNewsJsonObject,
  AiNewsRawItem,
  AiNewsScoredCandidate,
  AiNewsSourceConfig,
  AiNewsSourceFailure,
} from "@/lib/ai-news-types"
import { generatePostReview, isAutoPublishableReview } from "@/lib/ai-review"
import { ValidationError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

export type AiNewsSource = {
  id: string
  name: string
  feedUrl: string
  homepage?: string
}

export type AiNewsItem = {
  id: string
  title: string
  url: string
  summary: string
  sourceId: string
  sourceName: string
  publishedAt: Date | null
}

export type DailyAiNewsDraft = {
  title: string
  slug: string
  excerpt: string
  content: string
  generatedBy: AiNewsGeneratorModel
}

export type AiNewsGeneratorModel = {
  id: string
  name: string
  model: string
}

type DashScopePayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

type DraftCandidate = {
  title?: unknown
  excerpt?: unknown
  content?: unknown
}

type AiNewsRunTriggerInput = "manual" | "cron"
type AiNewsRunStatusValue = "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function readScoreThresholdEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isFinite(value) && value >= 0 && value <= 10 ? value : fallback
}

/**
 * 默认的 AI 新闻来源清单。
 * 当数据库里没有自定义来源配置时，会使用这组兜底源。
 */
export const DAILY_AI_NEWS_SOURCES: AiNewsSource[] = [
  { id: "openai", name: "OpenAI Blog", feedUrl: "https://openai.com/news/rss.xml", homepage: "https://openai.com/news/" },
  { id: "anthropic", name: "Anthropic News", feedUrl: "https://www.anthropic.com/news/rss.xml", homepage: "https://www.anthropic.com/news" },
  { id: "google-ai", name: "Google AI", feedUrl: "https://blog.google/technology/ai/rss/", homepage: "https://blog.google/technology/ai/" },
  { id: "meta-ai", name: "Meta AI", feedUrl: "https://ai.meta.com/blog/rss/", homepage: "https://ai.meta.com/blog/" },
  { id: "hugging-face", name: "Hugging Face Blog", feedUrl: "https://huggingface.co/blog/feed.xml", homepage: "https://huggingface.co/blog" },
  { id: "techcrunch-ai", name: "TechCrunch AI", feedUrl: "https://techcrunch.com/category/artificial-intelligence/feed/", homepage: "https://techcrunch.com/category/artificial-intelligence/" },
  { id: "venturebeat-ai", name: "VentureBeat AI", feedUrl: "https://venturebeat.com/category/ai/feed/", homepage: "https://venturebeat.com/category/ai/" },
  { id: "the-decoder", name: "The Decoder", feedUrl: "https://the-decoder.com/feed/", homepage: "https://the-decoder.com/" },
]

const MAX_CANDIDATES_FOR_AI = readPositiveIntegerEnv("AI_NEWS_MAX_SELECTED_CANDIDATES", 20)
const MAX_CANDIDATES_TO_SCORE = readPositiveIntegerEnv("AI_NEWS_MAX_CANDIDATES_TO_SCORE", 24)
const MAX_FACT_CARDS = readPositiveIntegerEnv("AI_NEWS_MAX_FACT_CARDS", 12)
const AI_NEWS_AI_CONCURRENCY = readPositiveIntegerEnv("AI_NEWS_AI_CONCURRENCY", 3)
const AI_NEWS_SCORE_THRESHOLD = readScoreThresholdEnv("AI_NEWS_SCORE_THRESHOLD", 7)
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000
const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"])

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .trim()
}

function stripTags(value: string) {
  return xmlDecode(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim()
}

function readTag(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"))
  return match?.[1] ? xmlDecode(match[1]).trim() : ""
}

function readAtomHref(block: string) {
  const match = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)
  return match?.[1] ? xmlDecode(match[1]).trim() : ""
}

function readBlocks(xml: string, tagName: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tagName}>`, "gi"))).map((match) => match[1] ?? "")
}

function parseDate(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function canonicalizeUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()
    return url.toString().replace(/\/$/, "")
  } catch {
    return value.trim().replace(/\?.*$/, "").replace(/\/$/, "").toLowerCase()
  }
}

function makeItemId(sourceId: string, url: string, title: string) {
  return `${sourceId}:${canonicalizeUrl(url) || title.toLowerCase()}`
}

function normalizeExcerpt(value: string) {
  return stripTags(value).slice(0, 360)
}

function formatDateId(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normalizeRunTrigger(trigger: AiNewsRunTriggerInput) {
  return trigger === "cron" ? "CRON" : "MANUAL"
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Daily AI news generation failed"
}

function legacySourcesToConfigs(sources: AiNewsSource[]): AiNewsSourceConfig[] {
  return sources.map((source, index) => ({
    id: source.id,
    type: "RSS",
    name: source.name,
    url: source.feedUrl,
    homepage: source.homepage ?? null,
    enabled: true,
    weight: sources.length - index,
  }))
}

function isPlainObject(value: unknown): value is AiNewsJsonObject {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function jsonObjectOrNull(value: unknown): AiNewsJsonObject | null {
  return isPlainObject(value) ? value : null
}

function getAiNewsCandidateRepository(): AiNewsCandidateRepository | null {
  const client = prisma as unknown as Partial<AiNewsCandidateRepository>
  const delegate = client.aiNewsCandidate

  if (
    delegate &&
    typeof delegate.create === "function" &&
    typeof delegate.update === "function" &&
    typeof delegate.updateMany === "function" &&
    typeof delegate.findMany === "function"
  ) {
    return client as AiNewsCandidateRepository
  }

  return null
}

function candidateRecordToInput(record: AiNewsCandidateRecord): AiNewsCandidateInput {
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

function candidateToNewsItem(candidate: AiNewsCandidateInput | AiNewsScoredCandidate): AiNewsItem {
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

function sortRawItemsByDate(items: AiNewsRawItem[]) {
  return [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))
}

async function mapWithConcurrency<T, R>(
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

async function collectDailyAiNewsRawItems({
  date,
  sources,
  fetchImpl,
}: {
  date: Date
  sources?: AiNewsSource[]
  fetchImpl: typeof fetch
}) {
  const cutoff = new Date(date.getTime() - RECENT_WINDOW_MS)
  const sourceConfigs = sources
    ? legacySourcesToConfigs(sources)
    : await loadDailyAiNewsSources({
        prisma: prisma as unknown as { aiNewsSource?: { findMany?: (args?: unknown) => Promise<unknown[]> } },
      })
  const { items, failures } = await fetchAiNewsRawItems({ sources: sourceConfigs, since: cutoff, fetchImpl })
  const recentItems = items.filter((item) => !item.publishedAt || item.publishedAt >= cutoff)

  return {
    sourceConfigs,
    items: sortRawItemsByDate(recentItems),
    failures,
  }
}

async function persistDailyAiNewsCandidates({
  runId,
  candidates,
}: {
  runId: string
  candidates: AiNewsCandidateInput[]
}) {
  const repository = getAiNewsCandidateRepository()
  if (!repository) {
    return { repository: null, candidates }
  }

  const persisted = await persistAiNewsCandidates({ prisma: repository, runId, candidates })

  return {
    repository,
    candidates: persisted.map(candidateRecordToInput),
  }
}

async function scoreAndSelectDailyAiNewsCandidates({
  candidates,
  aiModel,
  fetchImpl,
}: {
  candidates: AiNewsCandidateInput[]
  aiModel: AiModelOption
  fetchImpl: typeof fetch
}) {
  const candidatesForScoring = candidates.slice(0, MAX_CANDIDATES_TO_SCORE)
  const scoreResults = await mapWithConcurrency(
    candidatesForScoring,
    AI_NEWS_AI_CONCURRENCY,
    (candidate) => scoreAiNewsCandidate({ candidate, aiModel, fetchImpl }),
  )
  const scoreById = new Map(scoreResults.map((score, index) => [candidatesForScoring[index]?.id, score]))
  const scoredCandidates: AiNewsScoredCandidate[] = candidates.map((candidate) => {
    const score = scoreById.get(candidate.id)

    return {
      ...candidate,
      aiScore: score?.score ?? 0,
      aiReason: score?.reason ?? null,
      aiSummary: score?.summary ?? null,
      aiTags: score?.tags ?? [],
      aiRiskFlags: score?.riskFlags ?? [],
      scoreError: score?.error ?? null,
    }
  })
  const selection = selectScoredCandidates({
    candidates: scoredCandidates,
    threshold: AI_NEWS_SCORE_THRESHOLD,
    maxSelected: MAX_CANDIDATES_FOR_AI,
  })

  if (selection.selected.length > 0) {
    const duplicateMap = await semanticDedupeCandidates({ candidates: selection.selected, aiModel, fetchImpl })
    const duplicateToPrimary = new Map<string, string>()

    for (const [primaryId, duplicateIds] of Object.entries(duplicateMap)) {
      for (const duplicateId of duplicateIds) {
        duplicateToPrimary.set(duplicateId, primaryId)
      }
    }

    const selectedCandidates = selection.selected
      .filter((candidate) => !duplicateToPrimary.has(candidate.id))
      .map((candidate) => ({
        ...candidate,
        selected: true,
        selectionReason: candidate.selectionReason ?? "Selected by score",
      }))
    const scoredWithDuplicateFlags = scoredCandidates.map((candidate) => {
      const duplicateOfId = duplicateToPrimary.get(candidate.id)
      if (!duplicateOfId) return candidate

      return {
        ...candidate,
        duplicateOfId,
        selected: false,
        selectionReason: `Semantic duplicate of ${duplicateOfId}`,
      }
    })

    return {
      scoredCandidates: scoredWithDuplicateFlags,
      selectedCandidates,
      duplicateMap,
      selection: {
        ...selection,
        selected: selectedCandidates,
        rejected: [
          ...selection.rejected,
          ...scoredWithDuplicateFlags.filter((candidate) => duplicateToPrimary.has(candidate.id)),
        ],
        citationCoverage: selectedCandidates.length
          ? selectedCandidates.filter((candidate) => Boolean(candidate.canonicalUrl || candidate.url)).length / selectedCandidates.length
          : 0,
      },
      generationMode: "candidate-pipeline" as const,
    }
  }

  const fallbackSelected = candidates.slice(0, MAX_CANDIDATES_FOR_AI).map((candidate) => ({
    ...candidate,
    aiScore: 0,
    aiReason: null,
    aiSummary: null,
    aiTags: [],
    aiRiskFlags: [],
    scoreError: null,
    selected: true,
    selectionReason: "Fallback selected because no candidate passed the AI score threshold",
  }))

  return {
    scoredCandidates,
    selectedCandidates: fallbackSelected,
    duplicateMap: {} as AiNewsDuplicateMap,
    selection: {
      ...selection,
      selected: fallbackSelected,
      qualityScore: 0,
      citationCoverage: fallbackSelected.length
        ? fallbackSelected.filter((candidate) => Boolean(candidate.canonicalUrl || candidate.url)).length / fallbackSelected.length
        : 0,
    },
    generationMode: "fallback" as const,
  }
}

async function buildDailyAiNewsDraftFromSelectedCandidates({
  date,
  candidates,
  aiModel,
  fetchImpl,
  generationMode,
}: {
  date: Date
  candidates: AiNewsScoredCandidate[]
  aiModel: AiModelOption
  fetchImpl: typeof fetch
  generationMode: "candidate-pipeline" | "fallback" | "legacy"
}) {
  const legacyDraft = await generateDailyAiNewsDraft({
    date,
    candidates: candidates.map(candidateToNewsItem),
    aiModel,
    fetchImpl,
  })

  if (generationMode !== "candidate-pipeline") {
    return { draft: legacyDraft, factCards: [] as AiNewsEnrichedFactCard[], citationCoverage: null as number | null }
  }

  const factCards = await mapWithConcurrency(
    candidates.slice(0, MAX_FACT_CARDS),
    AI_NEWS_AI_CONCURRENCY,
    (candidate) => generateFactCardForCandidate({ candidate, aiModel, fetchImpl }),
  )
  const renderedContent = renderDailyAiNewsMarkdown({
    date,
    selectedCandidates: candidates,
    factCards,
    aiModel,
  })

  return {
    draft: {
      ...legacyDraft,
      content: renderedContent,
    },
    factCards,
    citationCoverage: calculateCitationCoverage(factCards),
  }
}

function factCardToEnrichment(card: AiNewsEnrichedFactCard): AiNewsJsonObject {
  return JSON.parse(JSON.stringify(card)) as AiNewsJsonObject
}

function getDailyAiNewsAutoPublishBlockers({
  generationMode,
  selectedCandidateCount,
  citationCoverage,
  selectedCandidates,
  review,
}: {
  generationMode: "candidate-pipeline" | "fallback" | "legacy"
  selectedCandidateCount: number
  citationCoverage: number | null
  selectedCandidates: AiNewsScoredCandidate[]
  review: { verdict: "ready" | "needs-work"; score: number }
}) {
  if (generationMode !== "candidate-pipeline") {
    return []
  }

  const blockers: string[] = []
  const severeRiskFlags = new Set(["hallucination", "duplicate"])

  if (selectedCandidateCount < 6) {
    blockers.push("入选候选少于 6 条")
  }
  if ((citationCoverage ?? 0) < 0.9) {
    blockers.push("引用覆盖率低于 90%")
  }
  if (review.verdict !== "ready" || review.score < 88) {
    blockers.push("审稿结果未达到自动发布门槛")
  }
  if (selectedCandidates.some((candidate) => candidate.aiRiskFlags.some((flag) => severeRiskFlags.has(flag.toLowerCase())))) {
    blockers.push("存在高风险候选标记")
  }

  return blockers
}

function serializeSourceFailures(failures: AiNewsSourceFailure[]) {
  return failures.length > 0 ? failures : null
}

function toRunQualityScore(score: number | undefined) {
  if (!Number.isFinite(score)) return null
  return Math.round((score ?? 0) * 10)
}

async function finishAiNewsRun({
  runId,
  startedAtMs,
  data,
}: {
  runId: string
  startedAtMs: number
  data: Record<string, unknown> & { status: AiNewsRunStatusValue }
}) {
  await prisma.aiNewsRun.update({
    where: { id: runId },
    data: {
      ...data,
      finishedAt: new Date(),
      durationMs: Math.max(0, Date.now() - startedAtMs),
    },
  })
}

/**
 * 根据日期生成日报文章 slug。
 * 该 slug 稳定且可预测，便于幂等更新同一天的日报文章。
 */
export function buildDailyAiNewsSlug(date: Date) {
  return `ai-daily-${formatDateId(date)}`
}

/**
 * 解析单个 RSS / Atom feed，并统一映射为内部 AiNewsItem。
 * 这里只做格式解析与字段清洗，不负责跨源去重和业务筛选。
 */
export function parseNewsFeed(
  xml: string,
  source: Pick<AiNewsSource, "id" | "name"> | { sourceId: string; sourceName: string },
): AiNewsItem[] {
  const sourceId = "sourceId" in source ? source.sourceId : source.id
  const sourceName = "sourceName" in source ? source.sourceName : source.name
  const rssItems = readBlocks(xml, "item").map((block) => {
    const title = stripTags(readTag(block, "title"))
    const url = readTag(block, "link") || readTag(block, "guid")
    const summary = normalizeExcerpt(readTag(block, "description") || readTag(block, "content:encoded"))
    const publishedAt = parseDate(readTag(block, "pubDate") || readTag(block, "dc:date"))
    return { title, url, summary, publishedAt }
  })

  const atomItems = readBlocks(xml, "entry").map((block) => {
    const title = stripTags(readTag(block, "title"))
    const url = readAtomHref(block) || readTag(block, "id")
    const summary = normalizeExcerpt(readTag(block, "summary") || readTag(block, "content"))
    const publishedAt = parseDate(readTag(block, "updated") || readTag(block, "published"))
    return { title, url, summary, publishedAt }
  })

  return [...rssItems, ...atomItems]
    .filter((item) => item.title && item.url)
    .map((item) => ({
      id: makeItemId(sourceId, item.url, item.title),
      title: item.title,
      url: item.url,
      summary: item.summary,
      sourceId,
      sourceName,
      publishedAt: item.publishedAt,
    }))
}

/**
 * 基于 canonical URL 对新闻项做轻量去重。
 * 这是抓取阶段的第一层去重，后续还会有更重的语义去重流程。
 */
export function dedupeNewsItems(items: AiNewsItem[]) {
  const seen = new Set<string>()
  const result: AiNewsItem[] = []

  for (const item of items) {
    const key = canonicalizeUrl(item.url) || item.title.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }

  return result
}

/**
 * 拉取日报候选新闻。
 *
 * 返回内容包含：
 * - items: 已完成格式统一、时间窗口过滤、基础去重后的候选集合
 * - failures: 抓取失败的来源列表，供后台运行日志展示
 */
export async function fetchDailyAiNewsCandidates({
  date,
  sources = DAILY_AI_NEWS_SOURCES,
  fetchImpl = fetch,
}: {
  date: Date
  sources?: AiNewsSource[]
  fetchImpl?: typeof fetch
}) {
  const failures: Array<{ sourceId: string; message: string }> = []
  const batches = await Promise.all(
    sources.map(async (source) => {
      try {
        const response = await fetchImpl(source.feedUrl, { headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        return parseNewsFeed(await response.text(), source)
      } catch (error) {
        failures.push({ sourceId: source.id, message: error instanceof Error ? error.message : "Unknown feed error" })
        return []
      }
    }),
  )

  const cutoff = date.getTime() - RECENT_WINDOW_MS
  const items = dedupeNewsItems(batches.flat())
    .filter((item) => !item.publishedAt || item.publishedAt.getTime() >= cutoff)
    .sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0))

  return { items, failures }
}

function extractCompletionText(payload: DashScopePayload) {
  const content = payload.choices?.[0]?.message?.content

  if (typeof content === "string") return content.trim()
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  return ""
}

function stripJsonFence(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) return fenced[1].trim()

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1)

  return trimmed
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function parseDraftCandidate(text: string): DraftCandidate {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return typeof parsed === "object" && parsed !== null ? (parsed as DraftCandidate) : {}
  } catch {
    throw new ValidationError("AI news generation returned invalid JSON")
  }
}

function buildCandidateDigest(candidates: AiNewsItem[]) {
  return candidates
    .slice(0, MAX_CANDIDATES_FOR_AI)
    .map((item, index) => {
      const dateLabel = item.publishedAt ? item.publishedAt.toISOString() : "unknown-date"
      return [
        `${index + 1}. ${item.title}`,
        `source: ${item.sourceName}`,
        `publishedAt: ${dateLabel}`,
        `url: ${item.url}`,
        item.summary ? `summary: ${item.summary}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")
}

function appendSourceLinks(content: string, candidates: AiNewsItem[]) {
  const missingSources = candidates.filter((item) => !content.includes(item.url)).slice(0, MAX_CANDIDATES_FOR_AI)
  if (missingSources.length === 0) return content

  const sourceLinks = missingSources.map((item) => `- [${item.title}](${item.url}) — ${item.sourceName}`)
  if (/^#{1,6}\s+来源链接\s*$/im.test(content)) {
    return `${content.trim()}\n${sourceLinks.join("\n")}`
  }

  const sourceBlock = [
    "",
    "## 来源链接",
    ...sourceLinks,
  ].join("\n")

  return `${content.trim()}\n${sourceBlock}`
}

function escapeMarkdownInline(value: string) {
  return value.replace(/([\\`*_\[\]])/g, "\\$1")
}

function getGeneratorModelSnapshot(aiModel: AiModelOption): AiNewsGeneratorModel {
  return {
    id: aiModel.id,
    name: aiModel.name,
    model: aiModel.model,
  }
}

async function resolveDailyAiNewsModel(modelId?: string | null) {
  const aiModel = await getAiModelForCapability("post-summary", modelId)

  if (!aiModel) {
    throw new ValidationError("AI model is not available for daily AI news")
  }

  if (!aiModel.apiKey) {
    throw new Error(`${aiModel.apiKeyEnv} is not configured`)
  }

  return aiModel
}

function appendGeneratorAttribution(content: string, aiModel: AiModelOption) {
  const modelName = escapeMarkdownInline(aiModel.name)
  const model = escapeMarkdownInline(aiModel.model)
  const attribution = [
    "",
    "---",
    "",
    `> 生成标注：本文由 AI 模型 **${modelName}**（${model}）生成，基于上方公开来源整理。`,
  ].join("\n")

  return `${content.trim()}\n${attribution}`
}

/**
 * 调用选定模型生成中文 AI 日报草稿。
 *
 * 输入要求：
 * - candidates 必须先经过候选筛选，否则会放大模型噪声
 * - modelId 可选；不传时会回退到 post-summary 能力对应的默认模型
 *
 * 输出结果：
 * - 标题、slug、摘要、Markdown 正文
 * - generatedBy 快照，便于后续追踪是哪个模型生成的内容
 */
export async function generateDailyAiNewsDraft({
  date,
  candidates,
  aiModel,
  modelId,
  fetchImpl = fetch,
}: {
  date: Date
  candidates: AiNewsItem[]
  aiModel?: AiModelOption
  modelId?: string | null
  fetchImpl?: typeof fetch
}): Promise<DailyAiNewsDraft> {
  const selectedCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_AI)
  if (selectedCandidates.length === 0) {
    throw new ValidationError("No AI news candidates available")
  }

  const resolvedModel = aiModel ?? (await resolveDailyAiNewsModel(modelId))

  const dateLabel = formatDateId(date)
  const prompt = [
    `请基于候选新闻生成一篇中文 AI 新闻日报博客，日期为 ${dateLabel}。`,
    "只输出一个 JSON 对象，不要 Markdown 代码围栏以外的解释。",
    "JSON 字段：title, excerpt, content。",
    "要求：",
    "1. title 使用“YYYY-MM-DD AI 日报：核心主题”格式，不超过 80 个中文字符。",
    "2. excerpt 为 70-120 个中文字符。",
    "3. content 为 Markdown，包含：今日摘要、最重要的 3 件事、开源与开发者动态、模型与研究进展、产品与商业动态、来源链接。",
    "4. 只使用候选新闻给出的事实，不编造未提供的数据；每条重要新闻保留来源名称。",
    "5. 优先选择 8-12 条信息密度高、对开发者或行业有价值的新闻。",
    `候选新闻：\n${buildCandidateDigest(selectedCandidates)}`,
  ].join("\n\n")

  const response = await fetchImpl(`${resolvedModel.baseUrl}${resolvedModel.requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedModel.apiKey}`,
    },
    body: JSON.stringify({
      model: resolvedModel.model,
      messages: [
        { role: "system", content: "你是严谨的中文 AI 新闻主编，输出必须是可解析 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 2400,
      ...getAiModelChatRequestExtras(resolvedModel),
    }),
  })

  const payload = (await response.json()) as DashScopePayload
  if (!response.ok) {
    throw new Error(payload.error?.message || "AI news generation failed")
  }

  const candidate = parseDraftCandidate(extractCompletionText(payload))
  const title = readString(candidate.title)
  const excerpt = readString(candidate.excerpt)
  const content = readString(candidate.content)

  if (!title || !excerpt || !content) {
    throw new Error("AI news generation failed")
  }

  return {
    title: title.slice(0, 160),
    slug: buildDailyAiNewsSlug(date),
    excerpt: excerpt.slice(0, 320),
    content: appendGeneratorAttribution(appendSourceLinks(content, selectedCandidates), resolvedModel),
    generatedBy: getGeneratorModelSnapshot(resolvedModel),
  }
}

/**
 * 执行完整的 AI 日报流水线。
 *
 * 这是模块主入口，会串联：
 * 1. 创建运行记录
 * 2. 拉取并持久化候选新闻
 * 3. 去重、评分、富化、筛选
 * 4. 生成日报草稿
 * 5. 创建或更新后台文章
 * 6. 依据审核结果决定是否自动发布
 * 7. 回写运行状态与质量指标
 */
export async function runDailyAiNews({
  authorId,
  date = new Date(),
  modelId,
  regenerate = false,
  sources,
  fetchImpl = fetch,
  trigger = "manual",
}: {
  authorId: string
  date?: Date
  modelId?: string | null
  regenerate?: boolean
  sources?: AiNewsSource[]
  fetchImpl?: typeof fetch
  trigger?: AiNewsRunTriggerInput
}) {
  const startedAtMs = Date.now()
  const run = await prisma.aiNewsRun.create({
    data: {
      runDate: date,
      trigger: normalizeRunTrigger(trigger),
      status: "RUNNING",
    },
  })
  let sourceCount = 0
  let failureCount = 0
  let rawCandidateCount = 0
  let dedupedCandidateCount = 0
  let scoredCandidateCount = 0
  let selectedCandidateCount = 0
  let sourceFailureJson: AiNewsSourceFailure[] = []
  let qualityScore: number | null = null
  let citationCoverage: number | null = null
  let generationMode: "candidate-pipeline" | "fallback" | "legacy" = "legacy"

  const slug = buildDailyAiNewsSlug(date)
  try {
    const existing = await prisma.post.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, title: true, slug: true, published: true },
    })

    if (existing && !regenerate) {
      await finishAiNewsRun({
        runId: run.id,
        startedAtMs,
        data: {
          status: "SKIPPED",
          sourceCount: 0,
          failureCount: 0,
          rawCandidateCount: 0,
          dedupedCandidateCount: 0,
          scoredCandidateCount: 0,
          selectedCandidateCount: 0,
          postId: existing.id,
          postTitle: existing.title,
          postSlug: existing.slug,
          published: existing.published,
        },
      })

      return {
        operation: "skipped" as const,
        reason: "Daily AI news already exists",
        published: existing.published,
        post: existing,
        sourceCount: 0,
        failures: [],
        run: { id: run.id, status: "SKIPPED" as const },
      }
    }

    const aiModel = await resolveDailyAiNewsModel(modelId)
    const { sourceConfigs, items: rawItems, failures } = await collectDailyAiNewsRawItems({ date, sources, fetchImpl })
    const dedupedCandidates = dedupeByCanonicalUrl(rawItems)
    const persistedCandidates = await persistDailyAiNewsCandidates({ runId: run.id, candidates: dedupedCandidates })
    const { scoredCandidates, selectedCandidates, duplicateMap, selection, generationMode: selectedGenerationMode } =
      await scoreAndSelectDailyAiNewsCandidates({
        candidates: persistedCandidates.candidates,
        aiModel,
        fetchImpl,
      })

    sourceCount = rawItems.length
    failureCount = failures.length
    rawCandidateCount = rawItems.length
    dedupedCandidateCount = dedupedCandidates.length
    scoredCandidateCount = Math.min(persistedCandidates.candidates.length, MAX_CANDIDATES_TO_SCORE)
    selectedCandidateCount = selectedCandidates.length
    sourceFailureJson = failures
    qualityScore = toRunQualityScore(selection.qualityScore)
    citationCoverage = selection.citationCoverage ?? null
    generationMode = selectedGenerationMode

    if (persistedCandidates.repository) {
      const scoreUpdateResult = await updateAiNewsCandidateScores({
        prisma: persistedCandidates.repository,
        scores: scoredCandidates.map((candidate) => ({
          id: candidate.id,
          aiScore: candidate.aiScore,
          aiReason: candidate.aiReason,
          aiSummary: candidate.aiSummary,
          aiTags: candidate.aiTags,
          aiRiskFlags: candidate.aiRiskFlags,
          scoreError: candidate.scoreError,
        })),
      })
      const duplicateUpdateResult = await markAiNewsCandidateDuplicates({
        prisma: persistedCandidates.repository,
        duplicates: Object.entries(duplicateMap).flatMap(([duplicateOfId, duplicateIds]) =>
          duplicateIds.map((id) => ({ id, duplicateOfId })),
        ),
      })

      await markSelectedAiNewsCandidates({
        prisma: persistedCandidates.repository,
        runId: run.id,
        selected: selectedCandidates.map((candidate) => ({
          id: candidate.id,
          selectionReason: candidate.selectionReason,
        })),
      })

      if (scoreUpdateResult.failures.length > 0) {
        sourceFailureJson = [
          ...sourceFailureJson,
          ...scoreUpdateResult.failures.map((failure) => ({
            stage: "persist" as const,
            message: `Failed to update candidate score ${failure.id}: ${failure.error.message}`,
          })),
        ]
      }
      if (duplicateUpdateResult.failures.length > 0) {
        sourceFailureJson = [
          ...sourceFailureJson,
          ...duplicateUpdateResult.failures.map((failure) => ({
            stage: "persist" as const,
            message: `Failed to update candidate duplicate ${failure.id}: ${failure.error.message}`,
          })),
        ]
      }
    }

    const {
      draft,
      factCards,
      citationCoverage: renderedCitationCoverage,
    } = await buildDailyAiNewsDraftFromSelectedCandidates({
      date,
      candidates: selectedCandidates,
      aiModel,
      fetchImpl,
      generationMode,
    })
    citationCoverage = renderedCitationCoverage ?? citationCoverage
    const factCardByTitle = new Map(factCards.map((card) => [card.title.trim().toLowerCase(), card]))

    if (persistedCandidates.repository && factCards.length > 0) {
      const enrichmentUpdateResult = await updateAiNewsCandidateEnrichments({
        prisma: persistedCandidates.repository,
        enrichments: selectedCandidates
          .map((candidate) => {
            const card = factCardByTitle.get(candidate.title.trim().toLowerCase())
            return card ? { id: candidate.id, enrichment: factCardToEnrichment(card) } : null
          })
          .filter((item): item is { id: string; enrichment: AiNewsJsonObject } => Boolean(item)),
      })

      if (enrichmentUpdateResult.failures.length > 0) {
        sourceFailureJson = [
          ...sourceFailureJson,
          ...enrichmentUpdateResult.failures.map((failure) => ({
            stage: "persist" as const,
            message: `Failed to update candidate enrichment ${failure.id}: ${failure.error.message}`,
          })),
        ]
      }
    }

    const post = existing
      ? {
          ...(await updateAdminPost({
            id: existing.id,
            input: {
              title: draft.title,
              slug: draft.slug,
              content: draft.content,
              excerpt: draft.excerpt,
              published: existing.published,
            },
          })),
          title: draft.title,
        }
      : await createAdminPost({
          authorId,
          input: {
            title: draft.title,
            slug: draft.slug,
            content: draft.content,
            excerpt: draft.excerpt,
            published: false,
          },
        })

    let published = post.published
    let autoReview:
      | { verdict: "ready" | "needs-work"; score: number; summary: string; published: boolean; error?: never }
      | { published: false; error: string; verdict?: never; score?: never; summary?: never }
      | null = null

    try {
      const review = await generatePostReview({
        title: draft.title,
        slug: draft.slug,
        content: draft.content,
      })

      if (review) {
        const autoPublishBlockers = getDailyAiNewsAutoPublishBlockers({
          generationMode,
          selectedCandidateCount,
          citationCoverage,
          selectedCandidates,
          review,
        })

        if (!published && autoPublishBlockers.length === 0 && isAutoPublishableReview(review)) {
          await publishAiDraftPost({ postId: post.id })
          published = true
        }

        autoReview = {
          verdict: review.verdict,
          score: review.score,
          summary: autoPublishBlockers.length > 0
            ? `${review.summary}；未自动发布：${autoPublishBlockers.join("；")}`
            : review.summary,
          published,
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown review error"
      autoReview = { published: false, error: `Automatic review failed: ${message}` }
    }

    const reviewRunData =
      autoReview && !("error" in autoReview)
        ? {
            reviewVerdict: autoReview.verdict,
            reviewScore: autoReview.score,
            reviewSummary: autoReview.summary,
          }
        : {
            reviewVerdict: null,
            reviewScore: null,
            reviewSummary: autoReview?.error ?? null,
          }

    await finishAiNewsRun({
      runId: run.id,
      startedAtMs,
      data: {
        status: "SUCCEEDED",
        sourceCount,
        failureCount,
        rawCandidateCount,
        dedupedCandidateCount,
        scoredCandidateCount,
        selectedCandidateCount,
        sourceFailureJson: serializeSourceFailures(sourceFailureJson),
        qualityScore,
        citationCoverage,
        generationMode,
        postId: post.id,
        postTitle: post.title,
        postSlug: post.slug,
        published,
        ...reviewRunData,
      },
    })

    return {
      operation: existing ? "regenerated" as const : "created" as const,
      published,
      post: { ...post, published },
      autoReview,
      sourceCount,
      failures,
      metrics: {
        rawCandidateCount,
        dedupedCandidateCount,
        scoredCandidateCount,
        selectedCandidateCount,
        sourceFailureJson,
        qualityScore,
        citationCoverage,
        generationMode,
        configuredSourceCount: sourceConfigs.length,
      },
      generatedBy: draft.generatedBy,
      run: { id: run.id, status: "SUCCEEDED" as const },
    }
  } catch (error) {
    await finishAiNewsRun({
      runId: run.id,
      startedAtMs,
      data: {
        status: "FAILED",
        sourceCount,
        failureCount: Math.max(failureCount, 1),
        rawCandidateCount,
        dedupedCandidateCount,
        scoredCandidateCount,
        selectedCandidateCount,
        sourceFailureJson: serializeSourceFailures(sourceFailureJson),
        qualityScore,
        citationCoverage,
        generationMode,
        error: readErrorMessage(error),
      },
    })

    throw error
  }
}
