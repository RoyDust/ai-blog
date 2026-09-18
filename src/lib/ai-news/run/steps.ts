/**
 * AI 日报编排的步骤函数。
 *
 * 每个函数对应流水线的一段：
 * 源配置解析 → 原始条目收集 → 快照构建 → 候选持久化 → 评分选择 → 草稿构建 → run 收尾。
 * 依赖（仓储 / fetchImpl）一律显式入参，本模块不引用全局 prisma，
 * 以便在注入 fake 仓储时可以确定性地测试整条流水线。
 */
import type { AiModelOption } from "@/lib/ai-models"
import {
  persistAiNewsCandidates,
  type AiNewsCandidateRepository,
} from "@/lib/ai-news/candidates"
import { semanticDedupeCandidates, type AiNewsDuplicateMap } from "@/lib/ai-news/dedupe"
import { generateDailyAiNewsDraft } from "@/lib/ai-news/draft-flow"
import { generateDailyAiNewsEditorialBrief } from "@/lib/ai-news/editorial-compose"
import { calculateCitationCoverage, generateFactCardForCandidate, type AiNewsEnrichedFactCard } from "@/lib/ai-news/enrichment"
import { fetchAiNewsRawItems } from "@/lib/ai-news/fetchers"
import type { AiNewsSource } from "@/lib/ai-news/parser"
import { renderDailyAiNewsMarkdown } from "@/lib/ai-news/renderer"
import {
  AI_NEWS_AI_CONCURRENCY,
  AI_NEWS_SCORE_THRESHOLD,
  MAX_CANDIDATES_FOR_AI,
  MAX_CANDIDATES_TO_SCORE,
  MAX_FACT_CARDS,
  RECENT_WINDOW_MS,
  type AiNewsRunStatusValue,
  type AiNewsSourceMode,
} from "@/lib/ai-news/run/config"
import {
  candidateRecordToInput,
  candidateToNewsItem,
  mapWithConcurrency,
  sortRawItemsByDate,
} from "@/lib/ai-news/run/tools"
import { loadDailyAiNewsSources, loadSelectedDailyAiNewsSources } from "@/lib/ai-news/sources"
import { scoreAiNewsCandidate, selectScoredCandidates } from "@/lib/ai-news/scoring"
import { ValidationError } from "@/lib/api-errors"
import type {
  AiNewsCandidateInput,
  AiNewsScoredCandidate,
  AiNewsSourceConfig,
  AiNewsSourceSnapshot,
} from "@/lib/ai-news/types"

/**
 * run 编排依赖的结构化仓储。
 *
 * 与 AiNewsCandidateRepository 相同的结构探测风格：
 * aiNewsRun 负责运行记录的 create/update，post 负责按 slug 存在性检查与
 * generatedByAiNews 回写。aiNewsSource 是可选 delegate（形状与 sources.ts
 * 的 loader options 一致），供 loadDailyAiNewsSources / loadSelectedDailyAiNewsSources
 * 结构探测；缺失（fake 仓储）或表不存在时回退默认源清单。
 * 方法签名保持宽松，便于 fake 仓储与全局 prisma 同时满足。
 */
export type AiNewsRunPostSummary = {
  id: string
  title: string
  slug: string
  published: boolean
}

export type AiNewsRunRepository = {
  aiNewsRun: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>
  }
  post: {
    findFirst(args: {
      where: Record<string, unknown>
      select?: Record<string, boolean>
    }): Promise<AiNewsRunPostSummary | null>
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>
  }
  aiNewsSource?: {
    findMany?: (args?: unknown) => Promise<unknown[]>
  }
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

/**
 * 解析本次运行使用的来源配置。
 *
 * 传入 legacy sources 时直接转换；否则通过仓储读取 AiNewsSource 表，
 * 表缺失或读取失败时回退 DEFAULT 源（与 loadDailyAiNewsSources 语义一致）。
 */
export async function resolveDailyAiNewsSourceConfigs({
  sources,
  sourceMode,
  sourceIds,
  repository,
}: {
  sources?: AiNewsSource[]
  sourceMode: AiNewsSourceMode
  sourceIds?: string[]
  repository: AiNewsRunRepository
}) {
  if (sources) {
    return legacySourcesToConfigs(sources)
  }

  if (sourceMode === "selected") {
    const ids = Array.from(new Set((sourceIds ?? []).map((id) => id.trim()).filter(Boolean)))
    if (ids.length === 0) {
      throw new ValidationError("At least one AI news source must be selected")
    }

    const { sources: selectedSources, missingIds } = await loadSelectedDailyAiNewsSources({
      prisma: repository,
      sourceIds: ids,
    })

    if (missingIds.length > 0) {
      throw new ValidationError(`Unknown AI news sources: ${missingIds.join(", ")}`)
    }
    if (selectedSources.length === 0) {
      throw new ValidationError("At least one AI news source must be selected")
    }

    return selectedSources
  }

  return loadDailyAiNewsSources({ prisma: repository })
}

/**
 * Loads source configuration, fetches raw items, then keeps only the recent window.
 */
export async function collectDailyAiNewsRawItems({
  date,
  sourceConfigs,
  fetchImpl,
}: {
  date: Date
  sourceConfigs: AiNewsSourceConfig[]
  fetchImpl: typeof fetch
}) {
  const cutoff = new Date(date.getTime() - RECENT_WINDOW_MS)
  const { items, failures } = await fetchAiNewsRawItems({ sources: sourceConfigs, since: cutoff, fetchImpl })
  const recentItems = items.filter((item) => !item.publishedAt || item.publishedAt >= cutoff)

  return {
    sourceConfigs,
    items: sortRawItemsByDate(recentItems),
    failures,
  }
}

export function buildAiNewsSourceSnapshot(sources: AiNewsSourceConfig[]): AiNewsSourceSnapshot[] {
  return sources.map((source) => ({
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    homepage: source.homepage ?? null,
    category: source.category ?? null,
    enabled: source.enabled !== false,
    defaultEnabled: source.defaultEnabled ?? source.enabled !== false,
    weight: source.weight,
    minScore: source.minScore ?? null,
    fetchLimit: source.fetchLimit ?? null,
  }))
}

/**
 * Persists candidate rows when the migration-backed repository is available.
 * Passing a null repository keeps the run in the in-memory candidate mode
 * (test and legacy environments).
 */
export async function persistDailyAiNewsCandidates({
  runId,
  candidates,
  repository,
}: {
  runId: string
  candidates: AiNewsCandidateInput[]
  repository: AiNewsCandidateRepository | null
}) {
  if (!repository) {
    return { repository: null, candidates }
  }

  const persisted = await persistAiNewsCandidates({ prisma: repository, runId, candidates })

  return {
    repository,
    candidates: persisted.map(candidateRecordToInput),
  }
}

/**
 * Scores, semantically dedupes, and selects the candidate set used for generation.
 * Falls back to newest candidates when score thresholds reject everything.
 */
export async function scoreAndSelectDailyAiNewsCandidates({
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

/**
 * Builds the final draft from selected candidates.
 * Candidate-pipeline mode replaces the legacy model draft body with deterministic rendered Markdown.
 */
export async function buildDailyAiNewsDraftFromSelectedCandidates({
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
  const editorialBrief = await generateDailyAiNewsEditorialBrief({
    date,
    candidates,
    factCards,
    aiModel,
    fetchImpl,
  })
  const renderedContent = renderDailyAiNewsMarkdown({
    date,
    selectedCandidates: candidates,
    factCards,
    editorialBrief,
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

/**
 * Finalizes a run record with status, metrics, and elapsed time.
 */
export async function finishAiNewsRun({
  runId,
  startedAtMs,
  data,
  repository,
}: {
  runId: string
  startedAtMs: number
  data: Record<string, unknown> & { status: AiNewsRunStatusValue }
  repository: AiNewsRunRepository
}) {
  const postId = typeof data.postId === "string" && data.postId.trim() ? data.postId : null

  await repository.aiNewsRun.update({
    where: { id: runId },
    data: {
      ...data,
      finishedAt: new Date(),
      durationMs: Math.max(0, Date.now() - startedAtMs),
    },
  })

  if (postId) {
    await repository.post.updateMany({
      where: { id: postId, generatedByAiNews: false },
      data: { generatedByAiNews: true },
    })
  }
}
