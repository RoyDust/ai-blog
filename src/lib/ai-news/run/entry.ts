/**
 * AI 日报聚合与发布编排入口。
 *
 * runDailyAiNews 串联：
 * 1. 基于日期的 PostgreSQL advisory lock + 超时僵尸 RUNNING 回收 + 创建运行记录
 * 2. 校验同名人工文章冲突与配置并触发 onRunCreated（支持 202 前同步落库 runId）
 * 3. 拉取并持久化候选新闻
 * 4. 去重、评分、富化、筛选
 * 5. 生成日报草稿（candidate-pipeline 模式零冗余 6000-token 调用）
 * 6. 创建或更新后台文章
 * 7. 完成增强后按模式发布并回写运行状态与质量指标
 */
import { createAdminPost, publishAiDraftPost, updateAdminPost } from "@/lib/ai-authoring"
import type { AiModelOption } from "@/lib/ai-models"
import {
  markAiNewsCandidateDuplicates,
  markSelectedAiNewsCandidates,
  updateAiNewsCandidateEnrichments,
  updateAiNewsCandidateScores,
  type AiNewsCandidateRepository,
} from "@/lib/ai-news/candidates"
import { DAILY_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"
import { dedupeByCanonicalUrl, type AiNewsDuplicateMap } from "@/lib/ai-news/dedupe"
import { resolveDailyAiNewsModel, type AiNewsGeneratorModel, type DailyAiNewsDraft } from "@/lib/ai-news/draft-flow"
import type { AiNewsEnrichedFactCard } from "@/lib/ai-news/enrichment"
import { buildDailyAiNewsSlug, dedupeNewsItems, parseNewsFeed, type AiNewsSource } from "@/lib/ai-news/parser"
import { applyAiNewsPostEnhancements } from "@/lib/ai-news/post-processing"
import {
  MAX_CANDIDATES_TO_SCORE,
  RECENT_WINDOW_MS,
  type AiNewsRunTriggerInput,
  type AiNewsSourceMode,
} from "@/lib/ai-news/run/config"
import {
  AI_NEWS_ADVISORY_LOCK_NAMESPACE,
  AI_NEWS_STALE_RUN_TIMEOUT_MS,
  buildAiNewsSourceSnapshot,
  buildDailyAiNewsDraftFromSelectedCandidates,
  collectDailyAiNewsRawItems,
  finishAiNewsRun,
  persistDailyAiNewsCandidates,
  reapStaleAiNewsRuns,
  resolveDailyAiNewsSourceConfigs,
  scoreAndSelectDailyAiNewsCandidates,
  STALE_AI_NEWS_RUN_ERROR,
  touchAiNewsRunHeartbeat,
  type AiNewsRunPostSummary,
  type AiNewsRunRepository,
} from "@/lib/ai-news/run/steps"
import {
  buildFactCardLookup,
  factCardToEnrichment,
  findFactCardForCandidate,
  getDailyAiNewsDateWindow,
  normalizeRunTrigger,
  readErrorMessage,
  serializeSourceFailures,
  toDailyAiNewsAdvisoryLockKey,
  toRunQualityScore,
} from "@/lib/ai-news/run/tools"
import type {
  AiNewsJsonObject,
  AiNewsScoredCandidate,
  AiNewsSourceConfig,
  AiNewsSourceFailure,
} from "@/lib/ai-news/types"
import { ConflictError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

export { AI_NEWS_STALE_RUN_TIMEOUT_MS, reapStaleAiNewsRuns, STALE_AI_NEWS_RUN_ERROR }

export const FALLBACK_SKIPPED_PUBLISHED_POST_REASON =
  "Fallback draft skipped to preserve published daily AI news"

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

type AiNewsCandidateUpdateFailure = {
  id: string
  error: Error
}

type PipelineProgressState = {
  sourceCount: number
  failureCount: number
  rawCandidateCount: number
  dedupedCandidateCount: number
  scoredCandidateCount: number
  selectedCandidateCount: number
  sourceFailureJson: AiNewsSourceFailure[]
  qualityScore: number | null
  citationCoverage: number | null
  generationMode: "candidate-pipeline" | "fallback" | "legacy"
}

const activeRunsByDate = new Map<string, string>()
const activeInProcessRunIds = new Set<string>()

/** 测试辅助：模拟进程崩溃重启后内存活跃运行态清空。 */
export function __resetAiNewsActiveRunsForTests() {
  activeRunsByDate.clear()
  activeInProcessRunIds.clear()
}

function createAlreadyRunningError(runId: string | null) {
  return Object.assign(new ConflictError("Daily AI news is already running for this date"), {
    code: "AI_NEWS_ALREADY_RUNNING" as const,
    runId,
  })
}

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

function getAiNewsRunRepository(): AiNewsRunRepository {
  const client = prisma as unknown as Partial<AiNewsRunRepository>
  const runDelegate = client.aiNewsRun
  const postDelegate = client.post

  if (
    runDelegate &&
    typeof runDelegate.create === "function" &&
    typeof runDelegate.update === "function" &&
    postDelegate &&
    typeof postDelegate.findFirst === "function"
  ) {
    return client as AiNewsRunRepository
  }

  throw new Error(
    "AI news run repository is unavailable: prisma client is missing aiNewsRun.create/update or post.findFirst delegates",
  )
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

function parseAdvisoryLockResult(rawResult: unknown): boolean {
  if (!Array.isArray(rawResult) || rawResult.length === 0) {
    return true
  }

  const firstRow = rawResult[0]
  if (!firstRow || typeof firstRow !== "object") {
    return true
  }

  const record = firstRow as Record<string, unknown>
  const flag = record.locked ?? record.pg_try_advisory_xact_lock
  return flag !== false
}

async function tryAcquirePgDateXactLock({
  repository,
  lockKey,
}: {
  repository: AiNewsRunRepository
  lockKey: number
}): Promise<boolean> {
  if (typeof repository.$queryRawUnsafe !== "function") {
    return true
  }

  const rawResult = await repository.$queryRawUnsafe(
    "SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS locked",
    AI_NEWS_ADVISORY_LOCK_NAMESPACE,
    lockKey,
  )
  return parseAdvisoryLockResult(rawResult)
}

async function assertAiNewsRunActive({
  runId,
  repository,
}: {
  runId: string
  repository: Pick<AiNewsRunRepository, "aiNewsRun">
}) {
  const stillActive = await touchAiNewsRunHeartbeat({ runId, repository })
  if (!stillActive) {
    throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
  }
}

async function claimDailyAiNewsRunSlot({
  date,
  trigger,
  staleRunTimeoutMs,
  repository,
}: {
  date: Date
  trigger: AiNewsRunTriggerInput
  staleRunTimeoutMs: number
  repository: AiNewsRunRepository
}) {
  const { dateId, start, end } = getDailyAiNewsDateWindow(date)
  const inMemoryRunId = activeRunsByDate.get(dateId)
  if (inMemoryRunId) {
    throw createAlreadyRunningError(inMemoryRunId === "__claiming__" ? null : inMemoryRunId)
  }

  activeRunsByDate.set(dateId, "__claiming__")
  const lockKey = toDailyAiNewsAdvisoryLockKey(date)
  const useTransaction = typeof repository.$transaction === "function"

  try {
    const claimInScope = async (scopeRepo: AiNewsRunRepository) => {
      if (useTransaction) {
        const acquired = await tryAcquirePgDateXactLock({
          repository: scopeRepo,
          lockKey,
        })

        if (!acquired) {
          const existingActive =
            typeof scopeRepo.aiNewsRun.findFirst === "function"
              ? await scopeRepo.aiNewsRun.findFirst({
                  where: { status: "RUNNING", runDate: { gte: start, lt: end } },
                  orderBy: { createdAt: "desc" },
                  select: { id: true },
                })
              : null
          throw createAlreadyRunningError(existingActive?.id ?? null)
        }
      }

      await reapStaleAiNewsRuns({
        repository: scopeRepo,
        now: new Date(),
        staleRunTimeoutMs,
        excludeRunIds: [...activeInProcessRunIds],
      })

      if (typeof scopeRepo.aiNewsRun.findFirst === "function") {
        const activeRun = await scopeRepo.aiNewsRun.findFirst({
          where: { status: "RUNNING", runDate: { gte: start, lt: end } },
          orderBy: { createdAt: "desc" },
          select: { id: true },
        })
        if (activeRun) {
          throw createAlreadyRunningError(activeRun.id)
        }
      }

      return scopeRepo.aiNewsRun.create({
        data: {
          runDate: date,
          trigger: normalizeRunTrigger(trigger),
          status: "RUNNING",
        },
      })
    }

    const run = useTransaction ? await repository.$transaction!(claimInScope) : await claimInScope(repository)
    activeRunsByDate.set(dateId, run.id)
    activeInProcessRunIds.add(run.id)

    return {
      run,
      release: async () => {
        if (activeRunsByDate.get(dateId) === run.id) {
          activeRunsByDate.delete(dateId)
        }
        activeInProcessRunIds.delete(run.id)
      },
    }
  } catch (error) {
    if (activeRunsByDate.get(dateId) === "__claiming__") {
      activeRunsByDate.delete(dateId)
    }
    throw error
  }
}

async function resolveExistingPostDecision({
  runId,
  startedAtMs,
  slug,
  regenerate,
  repository,
  onRunCreated,
}: {
  runId: string
  startedAtMs: number
  slug: string
  regenerate: boolean
  repository: AiNewsRunRepository
  onRunCreated?: (run: { id: string; status: "RUNNING" }) => void
}): Promise<{ kind: "continue"; existing: AiNewsRunPostSummary | null } | { kind: "skipped"; result: DailyAiNewsRunResult }> {
  const existing = await repository.post.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, title: true, slug: true, published: true, generatedByAiNews: true },
  })

  if (existing && existing.generatedByAiNews !== true) {
    if (regenerate) {
      throw new ConflictError("Daily AI news slug is occupied by a manual post")
    }

    onRunCreated?.({ id: runId, status: "RUNNING" })
    const conflictReason = "Daily AI news slug conflicts with a manual post"
    const finalized = await finishAiNewsRun({
      runId,
      startedAtMs,
      repository,
      data: {
        status: "SKIPPED",
        sourceCount: 0,
        failureCount: 0,
        rawCandidateCount: 0,
        dedupedCandidateCount: 0,
        scoredCandidateCount: 0,
        selectedCandidateCount: 0,
        postId: null,
        postTitle: existing.title,
        postSlug: existing.slug,
        published: existing.published,
        error: conflictReason,
      },
    })
    if (!finalized) {
      throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
    }

    return {
      kind: "skipped",
      result: {
        operation: "skipped",
        reason: conflictReason,
        published: existing.published,
        post: existing,
        sourceCount: 0,
        failures: [],
        run: { id: runId, status: "SKIPPED" },
      },
    }
  }

  if (existing && !regenerate) {
    onRunCreated?.({ id: runId, status: "RUNNING" })
    const published = existing.published
    const reason = published ? "Daily AI news already exists" : "Daily AI news draft is pending review"

    const finalized = await finishAiNewsRun({
      runId,
      startedAtMs,
      repository,
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
    if (!finalized) {
      throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
    }

    return {
      kind: "skipped",
      result: {
        operation: "skipped",
        reason,
        published,
        post: { ...existing, published },
        sourceCount: 0,
        failures: [],
        run: { id: runId, status: "SKIPPED" },
      },
    }
  }

  return { kind: "continue", existing }
}

async function persistCandidateStageResults({
  runId,
  repository,
  scoredCandidates,
  selectedCandidates,
  duplicateMap,
  sourceFailureJson,
}: {
  runId: string
  repository: AiNewsCandidateRepository | null
  scoredCandidates: AiNewsScoredCandidate[]
  selectedCandidates: AiNewsScoredCandidate[]
  duplicateMap: AiNewsDuplicateMap
  sourceFailureJson: AiNewsSourceFailure[]
}) {
  if (!repository) {
    return sourceFailureJson
  }

  const scoreUpdateResult = await updateAiNewsCandidateScores({
    prisma: repository,
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
    prisma: repository,
    duplicates: Object.entries(duplicateMap).flatMap(([duplicateOfId, duplicateIds]) =>
      duplicateIds.map((id) => ({ id, duplicateOfId })),
    ),
  })

  await markSelectedAiNewsCandidates({
    prisma: repository,
    runId,
    selected: selectedCandidates.map((candidate) => ({
      id: candidate.id,
      selectionReason: candidate.selectionReason,
    })),
  })

  let nextFailures = appendPersistFailures(sourceFailureJson, scoreUpdateResult.failures, "score")
  nextFailures = appendPersistFailures(nextFailures, duplicateUpdateResult.failures, "duplicate")
  return nextFailures
}

async function persistCandidateEnrichmentResults({
  repository,
  selectedCandidates,
  factCards,
  sourceFailureJson,
}: {
  repository: AiNewsCandidateRepository | null
  selectedCandidates: AiNewsScoredCandidate[]
  factCards: AiNewsEnrichedFactCard[]
  sourceFailureJson: AiNewsSourceFailure[]
}) {
  if (!repository || factCards.length === 0) {
    return sourceFailureJson
  }

  const factCardLookup = buildFactCardLookup(factCards)
  const enrichmentUpdateResult = await updateAiNewsCandidateEnrichments({
    prisma: repository,
    enrichments: selectedCandidates
      .map((candidate) => {
        const card = findFactCardForCandidate(factCardLookup, candidate)
        return card ? { id: candidate.id, enrichment: factCardToEnrichment(card) } : null
      })
      .filter((item): item is { id: string; enrichment: AiNewsJsonObject } => Boolean(item)),
  })

  return appendPersistFailures(sourceFailureJson, enrichmentUpdateResult.failures, "enrichment")
}

async function persistAndPublishDailyAiNewsPost({
  runId,
  runRepository,
  authorId,
  existing,
  draft,
  modelId,
  generationMode,
  shouldEnhance,
}: {
  runId: string
  runRepository: AiNewsRunRepository
  authorId: string
  existing: AiNewsRunPostSummary | null
  draft: DailyAiNewsDraft
  modelId?: string | null
  generationMode: "candidate-pipeline" | "fallback" | "legacy"
  shouldEnhance: boolean
}) {
  if (existing?.published && generationMode === "fallback") {
    return {
      skippedPublishedFallback: true as const,
      post: existing,
      finalPost: { ...existing, published: true },
      published: true,
    }
  }

  await assertAiNewsRunActive({ runId, repository: runRepository })

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
  const enhancementResult = shouldEnhance
    ? await applyAiNewsPostEnhancements({ postId: post.id, modelId })
    : { post: null }
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

  if (!published && generationMode !== "fallback") {
    await assertAiNewsRunActive({ runId, repository: runRepository })
    await publishAiDraftPost({ postId: post.id })
    published = true
  }

  return { skippedPublishedFallback: false as const, post, finalPost, published }
}

async function runActiveDailyAiNewsGeneration({
  runId,
  startedAtMs,
  authorId,
  date,
  modelId,
  existing,
  sourceConfigs,
  aiModel,
  fetchImpl,
  runRepository,
  candidateRepository,
  progress,
}: {
  runId: string
  startedAtMs: number
  authorId: string
  date: Date
  modelId?: string | null
  existing: AiNewsRunPostSummary | null
  sourceConfigs: AiNewsSourceConfig[]
  aiModel: AiModelOption
  fetchImpl: typeof fetch
  runRepository: AiNewsRunRepository
  candidateRepository: AiNewsCandidateRepository | null
  progress: PipelineProgressState
}): Promise<DailyAiNewsRunResult> {
  const { items: rawItems, failures } = await collectDailyAiNewsRawItems({ date, sourceConfigs, fetchImpl })
  await assertAiNewsRunActive({ runId, repository: runRepository })

  const dedupedCandidates = dedupeByCanonicalUrl(rawItems)
  const persistedCandidates = await persistDailyAiNewsCandidates({
    runId,
    candidates: dedupedCandidates,
    repository: candidateRepository,
  })
  const { scoredCandidates, selectedCandidates, duplicateMap, selection, generationMode } =
    await scoreAndSelectDailyAiNewsCandidates({
      candidates: persistedCandidates.candidates,
      aiModel,
      fetchImpl,
    })

  progress.sourceCount = rawItems.length
  progress.failureCount = failures.length
  progress.rawCandidateCount = rawItems.length
  progress.dedupedCandidateCount = dedupedCandidates.length
  progress.scoredCandidateCount = Math.min(persistedCandidates.candidates.length, MAX_CANDIDATES_TO_SCORE)
  progress.selectedCandidateCount = selectedCandidates.length
  progress.sourceFailureJson = failures
  progress.qualityScore = toRunQualityScore(selection.qualityScore)
  progress.citationCoverage = selection.citationCoverage ?? null
  progress.generationMode = generationMode

  progress.sourceFailureJson = await persistCandidateStageResults({
    runId,
    repository: persistedCandidates.repository,
    scoredCandidates,
    selectedCandidates,
    duplicateMap,
    sourceFailureJson: progress.sourceFailureJson,
  })
  await assertAiNewsRunActive({ runId, repository: runRepository })

  if (existing?.published && generationMode === "fallback") {
    const finalized = await finishAiNewsRun({
      runId,
      startedAtMs,
      repository: runRepository,
      data: {
        status: "SKIPPED",
        sourceCount: progress.sourceCount,
        failureCount: progress.failureCount,
        rawCandidateCount: progress.rawCandidateCount,
        dedupedCandidateCount: progress.dedupedCandidateCount,
        scoredCandidateCount: progress.scoredCandidateCount,
        selectedCandidateCount: progress.selectedCandidateCount,
        sourceFailureJson: serializeSourceFailures(progress.sourceFailureJson),
        qualityScore: progress.qualityScore,
        citationCoverage: progress.citationCoverage,
        generationMode: progress.generationMode,
        postId: existing.id,
        postTitle: existing.title,
        postSlug: existing.slug,
        published: true,
        error: FALLBACK_SKIPPED_PUBLISHED_POST_REASON,
      },
    })
    if (!finalized) {
      throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
    }

    return {
      operation: "skipped",
      reason: FALLBACK_SKIPPED_PUBLISHED_POST_REASON,
      published: true,
      post: { ...existing, published: true },
      sourceCount: progress.sourceCount,
      failures,
      run: { id: runId, status: "SKIPPED" },
    }
  }

  const { draft, factCards, citationCoverage } = await buildDailyAiNewsDraftFromSelectedCandidates({
    date,
    candidates: selectedCandidates,
    aiModel,
    fetchImpl,
    generationMode,
  })
  progress.citationCoverage = citationCoverage ?? progress.citationCoverage

  progress.sourceFailureJson = await persistCandidateEnrichmentResults({
    repository: persistedCandidates.repository,
    selectedCandidates,
    factCards,
    sourceFailureJson: progress.sourceFailureJson,
  })

  const persistedPost = await persistAndPublishDailyAiNewsPost({
    runId,
    runRepository,
    authorId,
    existing,
    draft,
    modelId,
    generationMode,
    shouldEnhance: selectedCandidates.length > 0,
  })
  if (persistedPost.skippedPublishedFallback) {
    const finalized = await finishAiNewsRun({
      runId,
      startedAtMs,
      repository: runRepository,
      data: {
        status: "SKIPPED",
        sourceCount: progress.sourceCount,
        failureCount: progress.failureCount,
        rawCandidateCount: progress.rawCandidateCount,
        dedupedCandidateCount: progress.dedupedCandidateCount,
        scoredCandidateCount: progress.scoredCandidateCount,
        selectedCandidateCount: progress.selectedCandidateCount,
        sourceFailureJson: serializeSourceFailures(progress.sourceFailureJson),
        qualityScore: progress.qualityScore,
        citationCoverage: progress.citationCoverage,
        generationMode: progress.generationMode,
        postId: persistedPost.post.id,
        postTitle: persistedPost.finalPost.title,
        postSlug: persistedPost.finalPost.slug,
        published: true,
        error: FALLBACK_SKIPPED_PUBLISHED_POST_REASON,
      },
    })
    if (!finalized) {
      throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
    }

    return {
      operation: "skipped",
      reason: FALLBACK_SKIPPED_PUBLISHED_POST_REASON,
      published: true,
      post: { ...persistedPost.finalPost, published: true },
      sourceCount: progress.sourceCount,
      failures,
      run: { id: runId, status: "SKIPPED" },
    }
  }

  const { post, finalPost, published } = persistedPost

  const finalized = await finishAiNewsRun({
    runId,
    startedAtMs,
    repository: runRepository,
    data: {
      status: "SUCCEEDED",
      sourceCount: progress.sourceCount,
      failureCount: progress.failureCount,
      rawCandidateCount: progress.rawCandidateCount,
      dedupedCandidateCount: progress.dedupedCandidateCount,
      scoredCandidateCount: progress.scoredCandidateCount,
      selectedCandidateCount: progress.selectedCandidateCount,
      sourceFailureJson: serializeSourceFailures(progress.sourceFailureJson),
      qualityScore: progress.qualityScore,
      citationCoverage: progress.citationCoverage,
      generationMode: progress.generationMode,
      postId: post.id,
      postTitle: finalPost.title,
      postSlug: finalPost.slug,
      published,
      reviewVerdict: null,
      reviewScore: null,
      reviewSummary: null,
    },
  })
  if (!finalized) {
    throw new ConflictError(STALE_AI_NEWS_RUN_ERROR)
  }

  return {
    operation: existing ? "regenerated" : "created",
    published,
    post: { ...finalPost, published },
    autoReview: null,
    sourceCount: progress.sourceCount,
    failures,
    metrics: {
      rawCandidateCount: progress.rawCandidateCount,
      dedupedCandidateCount: progress.dedupedCandidateCount,
      scoredCandidateCount: progress.scoredCandidateCount,
      selectedCandidateCount: progress.selectedCandidateCount,
      sourceFailureJson: progress.sourceFailureJson,
      qualityScore: progress.qualityScore,
      citationCoverage: progress.citationCoverage,
      generationMode: progress.generationMode,
      configuredSourceCount: sourceConfigs.length,
    },
    generatedBy: draft.generatedBy,
    run: { id: runId, status: "SUCCEEDED" },
  }
}

/**
 * 拉取日报候选新闻（兼容旧入口）。
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
        const response = await fetchImpl(source.feedUrl, {
          headers: { Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
        })
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
  staleRunTimeoutMs = AI_NEWS_STALE_RUN_TIMEOUT_MS,
  onRunCreated,
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
  staleRunTimeoutMs?: number
  onRunCreated?: (run: { id: string; status: "RUNNING" }) => void
  runRepository?: AiNewsRunRepository
  candidateRepository?: AiNewsCandidateRepository | null
}): Promise<DailyAiNewsRunResult> {
  const runRepository = runRepositoryOverride ?? getAiNewsRunRepository()
  const candidateRepository =
    candidateRepositoryOverride === undefined ? getAiNewsCandidateRepository() : candidateRepositoryOverride

  const startedAtMs = Date.now()
  const { run, release } = await claimDailyAiNewsRunSlot({
    date,
    trigger,
    staleRunTimeoutMs,
    repository: runRepository,
  })

  const progress: PipelineProgressState = {
    sourceCount: 0,
    failureCount: 0,
    rawCandidateCount: 0,
    dedupedCandidateCount: 0,
    scoredCandidateCount: 0,
    selectedCandidateCount: 0,
    sourceFailureJson: [],
    qualityScore: null,
    citationCoverage: null,
    generationMode: "legacy",
  }

  try {
    const slug = buildDailyAiNewsSlug(date)
    const decision = await resolveExistingPostDecision({
      runId: run.id,
      startedAtMs,
      slug,
      regenerate,
      repository: runRepository,
      onRunCreated,
    })
    if (decision.kind === "skipped") {
      return decision.result
    }

    const sourceConfigs = await resolveDailyAiNewsSourceConfigs({
      sources,
      sourceMode,
      sourceIds,
      repository: runRepository,
    })
    const sourceSnapshotJson = buildAiNewsSourceSnapshot(sourceConfigs)
    await runRepository.aiNewsRun.update({
      where: { id: run.id },
      data: { sourceSnapshotJson },
    })
    const aiModel = await resolveDailyAiNewsModel(modelId)
    onRunCreated?.({ id: run.id, status: "RUNNING" })

    return await runActiveDailyAiNewsGeneration({
      runId: run.id,
      startedAtMs,
      authorId,
      date,
      modelId,
      existing: decision.existing,
      sourceConfigs,
      aiModel,
      fetchImpl,
      runRepository,
      candidateRepository,
      progress,
    })
  } catch (error) {
    await finishAiNewsRun({
      runId: run.id,
      startedAtMs,
      repository: runRepository,
      data: {
        status: "FAILED",
        sourceCount: progress.sourceCount,
        failureCount: Math.max(progress.failureCount, 1),
        rawCandidateCount: progress.rawCandidateCount,
        dedupedCandidateCount: progress.dedupedCandidateCount,
        scoredCandidateCount: progress.scoredCandidateCount,
        selectedCandidateCount: progress.selectedCandidateCount,
        sourceFailureJson: serializeSourceFailures(progress.sourceFailureJson),
        qualityScore: progress.qualityScore,
        citationCoverage: progress.citationCoverage,
        generationMode: progress.generationMode,
        error: readErrorMessage(error),
      },
    })

    throw error
  } finally {
    await release()
  }
}
