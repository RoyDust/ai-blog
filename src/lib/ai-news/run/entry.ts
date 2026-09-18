/**
 * AI 日报聚合与发布编排入口。
 *
 * runDailyAiNews 串联：
 * 1. 创建运行记录
 * 2. 拉取并持久化候选新闻
 * 3. 去重、评分、富化、筛选
 * 4. 生成日报草稿
 * 5. 创建或更新后台文章
 * 6. 完成增强后直接发布
 * 7. 回写运行状态与质量指标
 *
 * fetchDailyAiNewsCandidates 是旧的候选抓取入口，供后台测试与兼容场景使用。
 *
 * 依赖注入（均可选，缺省行为与历史版本一致）：
 * - runRepository：run 记录与文章存在性检查的结构化仓储；缺省对全局 prisma 做
 *   结构探测，探测失败直接抛错（run 记录不可静默丢弃）
 * - candidateRepository：候选持久化仓储；缺省探测全局 prisma（无表时走内存模式），
 *   显式传 null 可跳过持久化（测试/降级场景）
 */
import { createAdminPost, publishAiDraftPost, updateAdminPost } from "@/lib/ai-authoring"
import {
  markAiNewsCandidateDuplicates,
  markSelectedAiNewsCandidates,
  updateAiNewsCandidateEnrichments,
  updateAiNewsCandidateScores,
  type AiNewsCandidateRepository,
} from "@/lib/ai-news/candidates"
import { DAILY_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"
import { dedupeByCanonicalUrl } from "@/lib/ai-news/dedupe"
import { resolveDailyAiNewsModel, type AiNewsGeneratorModel } from "@/lib/ai-news/draft-flow"
import { buildDailyAiNewsSlug, dedupeNewsItems, parseNewsFeed, type AiNewsSource } from "@/lib/ai-news/parser"
import { applyAiNewsPostEnhancements } from "@/lib/ai-news/post-processing"
import {
  MAX_CANDIDATES_TO_SCORE,
  RECENT_WINDOW_MS,
  type AiNewsRunTriggerInput,
  type AiNewsSourceMode,
} from "@/lib/ai-news/run/config"
import {
  buildAiNewsSourceSnapshot,
  buildDailyAiNewsDraftFromSelectedCandidates,
  collectDailyAiNewsRawItems,
  finishAiNewsRun,
  persistDailyAiNewsCandidates,
  resolveDailyAiNewsSourceConfigs,
  scoreAndSelectDailyAiNewsCandidates,
  type AiNewsRunRepository,
} from "@/lib/ai-news/run/steps"
import {
  buildFactCardLookup,
  factCardToEnrichment,
  findFactCardForCandidate,
  normalizeRunTrigger,
  readErrorMessage,
  serializeSourceFailures,
  toRunQualityScore,
} from "@/lib/ai-news/run/tools"
import type { AiNewsJsonObject, AiNewsSourceFailure } from "@/lib/ai-news/types"
import { prisma } from "@/lib/prisma"

/** 日报结果中文章对象的公共字段；其余字段随创建/增强结果透传。 */
export type DailyAiNewsRunPost = {
  id: string
  title: string
  slug: string
  published: boolean
  [key: string]: unknown
}

/** created/regenerated 分支回传的流水线指标，与 run 记录回写的字段一致。 */
export type DailyAiNewsRunMetrics = {
  rawCandidateCount: number
  dedupedCandidateCount: number
  scoredCandidateCount: number
  selectedCandidateCount: number
  sourceFailureJson: AiNewsSourceFailure[] | null
  qualityScore: number | null
  citationCoverage: number | null
  generationMode: "candidate-pipeline" | "fallback" | "legacy"
  configuredSourceCount: number
}

type DailyAiNewsRunSuccessBase = {
  published: boolean
  post: DailyAiNewsRunPost
  autoReview: null
  sourceCount: number
  failures: AiNewsSourceFailure[]
  metrics: DailyAiNewsRunMetrics
  generatedBy: AiNewsGeneratorModel
  run: { id: string; status: "SUCCEEDED" }
}

/**
 * runDailyAiNews 的返回类型契约，按 operation 区分的判别联合。
 * 字段结构与历史返回值逐字段一致，供通知等下游模块类型安全地消费。
 */
export type DailyAiNewsRunResult =
  | {
      operation: "skipped"
      reason: string
      published: boolean
      post: DailyAiNewsRunPost
      sourceCount: number
      failures: AiNewsSourceFailure[]
      run: { id: string; status: "SKIPPED" }
    }
  | ({ operation: "created" } & DailyAiNewsRunSuccessBase)
  | ({ operation: "regenerated" } & DailyAiNewsRunSuccessBase)

/** 候选持久化写回失败的统一形态（scores / duplicates / enrichments 三处一致）。 */
type AiNewsCandidateUpdateFailure = {
  id: string
  error: Error
}

/**
 * 将 persist 阶段的候选写回失败追加进 sourceFailureJson。
 * description 逐字进入消息模板（"score" / "duplicate" / "enrichment"），
 * 失败消息格式被既有测试锁定，勿改动。
 */
function appendPersistFailures(
  sourceFailureJson: AiNewsSourceFailure[],
  failures: AiNewsCandidateUpdateFailure[],
  description: string,
): AiNewsSourceFailure[] {
  if (failures.length === 0) {
    return sourceFailureJson
  }

  return [
    ...sourceFailureJson,
    ...failures.map((failure) => ({
      stage: "persist" as const,
      message: `Failed to update candidate ${description} ${failure.id}: ${failure.error.message}`,
    })),
  ]
}

/**
 * 探测全局 prisma 上的 run 仓储委托。
 * 与候选仓储的结构探测风格一致，但 run 记录不可静默丢弃，探测失败必须 fail-loud。
 */
function getAiNewsRunRepository(): AiNewsRunRepository {
  const client = prisma as unknown as Partial<AiNewsRunRepository>
  const runDelegate = client.aiNewsRun
  const postDelegate = client.post

  if (
    runDelegate &&
    typeof runDelegate.create === "function" &&
    typeof runDelegate.update === "function" &&
    postDelegate &&
    typeof postDelegate.findFirst === "function" &&
    typeof postDelegate.updateMany === "function"
  ) {
    return client as AiNewsRunRepository
  }

  throw new Error(
    "AI news run repository is unavailable: prisma client is missing aiNewsRun.create/update or post.findFirst/updateMany delegates",
  )
}

/**
 * 探测全局 prisma 上的候选仓储委托。
 * 无表（迁移未应用）时返回 null，运行退回内存候选模式。
 */
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
 * 这是模块主入口。既有参数与返回结构保持不变，仅追加可选的
 * runRepository / candidateRepository 注入参数用于测试与部署定制。
 */
export async function runDailyAiNews({
  authorId,
  date = new Date(),
  modelId,
  regenerate = false,
  sources,
  sourceMode = "default",
  sourceIds,
  fetchImpl = fetch,
  trigger = "manual",
  runRepository: runRepositoryOverride,
  candidateRepository: candidateRepositoryOverride,
}: {
  authorId: string
  date?: Date
  modelId?: string | null
  regenerate?: boolean
  sources?: AiNewsSource[]
  sourceMode?: AiNewsSourceMode
  sourceIds?: string[]
  fetchImpl?: typeof fetch
  trigger?: AiNewsRunTriggerInput
  runRepository?: AiNewsRunRepository
  candidateRepository?: AiNewsCandidateRepository | null
}): Promise<DailyAiNewsRunResult> {
  const runRepository = runRepositoryOverride ?? getAiNewsRunRepository()
  const candidateRepository = candidateRepositoryOverride === undefined
    ? getAiNewsCandidateRepository()
    : candidateRepositoryOverride

  const startedAtMs = Date.now()
  const run = await runRepository.aiNewsRun.create({
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
    const existing = await runRepository.post.findFirst({
      where: { slug, deletedAt: null },
      select: { id: true, title: true, slug: true, published: true },
    })

    if (existing && !regenerate) {
      let published = existing.published
      if (!published) {
        await publishAiDraftPost({ postId: existing.id })
        published = true
      }
      const publishedPost = { ...existing, published }

      await finishAiNewsRun({
        runId: run.id,
        startedAtMs,
        repository: runRepository,
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
          published,
        },
      })

      return {
        operation: "skipped",
        reason: "Daily AI news already exists",
        published,
        post: publishedPost,
        sourceCount: 0,
        failures: [],
        run: { id: run.id, status: "SKIPPED" },
      }
    }

    const sourceConfigs = await resolveDailyAiNewsSourceConfigs({ sources, sourceMode, sourceIds, repository: runRepository })
    const sourceSnapshotJson = buildAiNewsSourceSnapshot(sourceConfigs)
    await runRepository.aiNewsRun.update({
      where: { id: run.id },
      data: { sourceSnapshotJson },
    })
    const aiModel = await resolveDailyAiNewsModel(modelId)
    const { items: rawItems, failures } = await collectDailyAiNewsRawItems({ date, sourceConfigs, fetchImpl })
    const dedupedCandidates = dedupeByCanonicalUrl(rawItems)
    const persistedCandidates = await persistDailyAiNewsCandidates({
      runId: run.id,
      candidates: dedupedCandidates,
      repository: candidateRepository,
    })
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

      sourceFailureJson = appendPersistFailures(sourceFailureJson, scoreUpdateResult.failures, "score")
      sourceFailureJson = appendPersistFailures(sourceFailureJson, duplicateUpdateResult.failures, "duplicate")
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
    const factCardLookup = buildFactCardLookup(factCards)

    if (persistedCandidates.repository && factCards.length > 0) {
      const enrichmentUpdateResult = await updateAiNewsCandidateEnrichments({
        prisma: persistedCandidates.repository,
        enrichments: selectedCandidates
          .map((candidate) => {
            const card = findFactCardForCandidate(factCardLookup, candidate)
            return card ? { id: candidate.id, enrichment: factCardToEnrichment(card) } : null
          })
          .filter((item): item is { id: string; enrichment: AiNewsJsonObject } => Boolean(item)),
      })

      sourceFailureJson = appendPersistFailures(sourceFailureJson, enrichmentUpdateResult.failures, "enrichment")
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
              generatedByAiNews: true,
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
            generatedByAiNews: true,
          },
        })

    let published = post.published
    const enhancementResult = await applyAiNewsPostEnhancements({ postId: post.id, modelId })
    const enhancedPost = enhancementResult.post ?? {
      id: post.id,
      title: draft.title,
      slug: draft.slug,
      content: draft.content,
      excerpt: draft.excerpt,
      seoDescription: null,
      category: null,
      tags: [],
      published: post.published,
      coverImage: null,
    }
    const finalPost = { ...post, ...enhancedPost }

    if (!published) {
      await publishAiDraftPost({ postId: post.id })
      published = true
    }

    await finishAiNewsRun({
      runId: run.id,
      startedAtMs,
      repository: runRepository,
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
        postTitle: finalPost.title,
        postSlug: finalPost.slug,
        published,
        reviewVerdict: null,
        reviewScore: null,
        reviewSummary: null,
      },
    })

    return {
      operation: existing ? "regenerated" : "created",
      published,
      post: { ...finalPost, published },
      autoReview: null,
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
      run: { id: run.id, status: "SUCCEEDED" },
    }
  } catch (error) {
    await finishAiNewsRun({
      runId: run.id,
      startedAtMs,
      repository: runRepository,
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
