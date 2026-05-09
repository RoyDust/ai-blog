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
import type { AiModelOption } from "@/lib/ai-models"
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
import { generateDailyAiNewsDraft, resolveDailyAiNewsModel } from "@/lib/ai-news-draft-flow"
import { calculateCitationCoverage, generateFactCardForCandidate, type AiNewsEnrichedFactCard } from "@/lib/ai-news-enrichment"
import { fetchAiNewsRawItems } from "@/lib/ai-news-fetchers"
import { buildDailyAiNewsSlug, dedupeNewsItems, parseNewsFeed, type AiNewsItem, type AiNewsSource } from "@/lib/ai-news-parser"
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
import { prisma } from "@/lib/prisma"

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
