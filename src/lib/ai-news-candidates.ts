/**
 * AI 日报候选项持久化仓库。
 *
 * 职责：
 * - 把抓取后的候选新闻写入 aiNewsCandidate 表
 * - 回写评分、去重、富化、入选结果等中间状态
 * - 为后台候选列表与运行详情页提供查询能力
 */
import type { AiNewsCandidateInput, AiNewsJsonObject, AiNewsSourceType } from "@/lib/ai-news-types"

type JsonPrimitive = string | number | boolean | null
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type AiNewsCandidateRecord = {
  id: string
  runId: string
  sourceId: string | null
  sourceType: AiNewsSourceType
  sourceName: string
  title: string
  url: string
  canonicalUrl: string
  summary: string | null
  content: string | null
  author: string | null
  publishedAt: Date | null
  metadata: JsonValue | null
  community: JsonValue | null
  aiScore: number | null
  aiReason: string | null
  aiSummary: string | null
  aiTags: string[]
  aiRiskFlags: string[]
  scoreError: string | null
  duplicateOfId: string | null
  selected: boolean
  selectionReason: string | null
  enrichment: JsonValue | null
}

type AiNewsCandidateCreateData = {
  runId: string
  sourceId: string | null
  sourceType: AiNewsSourceType
  sourceName: string
  title: string
  url: string
  canonicalUrl: string
  summary: string | null
  content: string | null
  author: string | null
  publishedAt: Date | null
  metadata: JsonValue | null
  community: JsonValue | null
  duplicateOfId: string | null
  enrichment: JsonValue | null
}

type AiNewsCandidateDelegate = {
  create(args: { data: AiNewsCandidateCreateData }): Promise<AiNewsCandidateRecord>
  update(args: {
    where: { id: string }
    data: Partial<Pick<
      AiNewsCandidateRecord,
      | "aiScore"
      | "aiReason"
      | "aiSummary"
      | "aiTags"
      | "aiRiskFlags"
      | "scoreError"
      | "duplicateOfId"
      | "enrichment"
      | "selected"
      | "selectionReason"
    >>
  }): Promise<AiNewsCandidateRecord>
  updateMany(args: {
    where: { runId: string }
    data: { selected: boolean; selectionReason: null }
  }): Promise<{ count: number }>
  findMany(args: {
    where: { runId: string; selected?: boolean }
    orderBy: Array<{ selected: "desc" } | { aiScore: "desc" } | { publishedAt: "desc" }>
  }): Promise<AiNewsCandidateRecord[]>
}

export type AiNewsCandidateRepository = {
  aiNewsCandidate: AiNewsCandidateDelegate
}

export type PersistAiNewsCandidateInput = AiNewsCandidateInput & {
  enrichment?: AiNewsJsonObject | null
}

export type UpdateAiNewsCandidateScoreInput = {
  id: string
  aiScore?: number | null
  aiReason?: string | null
  aiSummary?: string | null
  aiTags?: string[]
  aiRiskFlags?: string[]
  scoreError?: string | null
}

export type UpdateAiNewsCandidateScoresResult = {
  updated: AiNewsCandidateRecord[]
  failures: Array<{
    id: string
    error: Error
  }>
}

export type MarkSelectedAiNewsCandidateInput = {
  id: string
  selectionReason?: string | null
}

export type MarkSelectedAiNewsCandidatesResult = {
  clearedCount: number
  selected: AiNewsCandidateRecord[]
}

export type MarkAiNewsCandidateDuplicateInput = {
  id: string
  duplicateOfId: string
}

export type MarkAiNewsCandidateDuplicatesResult = {
  updated: AiNewsCandidateRecord[]
  failures: Array<{
    id: string
    error: Error
  }>
}

export type UpdateAiNewsCandidateEnrichmentInput = {
  id: string
  enrichment: AiNewsJsonObject | null
}

export type UpdateAiNewsCandidateEnrichmentsResult = {
  updated: AiNewsCandidateRecord[]
  failures: Array<{
    id: string
    error: Error
  }>
}

function toPrismaJson(value: AiNewsJsonObject | null | undefined): JsonValue | null {
  if (value == null) {
    return null
  }

  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function toCandidateCreateData(runId: string, candidate: PersistAiNewsCandidateInput): AiNewsCandidateCreateData {
  return {
    runId,
    sourceId: candidate.sourceId ?? null,
    sourceType: candidate.sourceType,
    sourceName: candidate.sourceName,
    title: candidate.title,
    url: candidate.url,
    canonicalUrl: candidate.canonicalUrl,
    summary: candidate.summary ?? null,
    content: candidate.content ?? null,
    author: candidate.author ?? null,
    publishedAt: candidate.publishedAt ?? null,
    metadata: toPrismaJson(candidate.metadata),
    community: toPrismaJson(candidate.community),
    duplicateOfId: candidate.duplicateOfId ?? null,
    enrichment: toPrismaJson(candidate.enrichment ?? (candidate.mergedSources ? { mergedSources: candidate.mergedSources } : null)),
  }
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value))
}

/**
 * 批量持久化候选新闻。
 * 若某条写入失败，会在错误消息中附带候选序号与标题，便于排查来源问题。
 */
export async function persistAiNewsCandidates({
  prisma,
  runId,
  candidates,
}: {
  prisma: AiNewsCandidateRepository
  runId: string
  candidates: PersistAiNewsCandidateInput[]
}) {
  if (candidates.length === 0) {
    return []
  }

  return Promise.all(
    candidates.map(async (candidate, index) => {
      try {
        return await prisma.aiNewsCandidate.create({
          data: toCandidateCreateData(runId, candidate),
        })
      } catch (error) {
        const cause = toError(error)
        throw new Error(`Failed to persist AI news candidate at index ${index} (${candidate.title}): ${cause.message}`, {
          cause,
        })
      }
    }),
  )
}

/**
 * 批量回写候选项 AI 评分结果。
 * 失败项会收集到 failures 中，而不是中断整批流程。
 */
export async function updateAiNewsCandidateScores({
  prisma,
  scores,
}: {
  prisma: AiNewsCandidateRepository
  scores: UpdateAiNewsCandidateScoreInput[]
}): Promise<UpdateAiNewsCandidateScoresResult> {
  const updated: AiNewsCandidateRecord[] = []
  const failures: UpdateAiNewsCandidateScoresResult["failures"] = []

  for (const score of scores) {
    try {
      updated.push(
        await prisma.aiNewsCandidate.update({
          where: { id: score.id },
          data: {
            aiScore: score.aiScore ?? null,
            aiReason: score.aiReason ?? null,
            aiSummary: score.aiSummary ?? null,
            aiTags: score.aiTags ?? [],
            aiRiskFlags: score.aiRiskFlags ?? [],
            scoreError: score.scoreError ?? null,
          },
        }),
      )
    } catch (error) {
      failures.push({ id: score.id, error: toError(error) })
    }
  }

  return { updated, failures }
}

/**
 * 标记本次运行中最终入选的候选项。
 * 当传入 runId 时，会先清空该轮的旧选中状态，再写入新的选择结果。
 */
export async function markSelectedAiNewsCandidates({
  prisma,
  runId,
  selected,
}: {
  prisma: AiNewsCandidateRepository
  runId?: string
  selected: MarkSelectedAiNewsCandidateInput[]
}): Promise<MarkSelectedAiNewsCandidatesResult> {
  const clearResult = runId
    ? await prisma.aiNewsCandidate.updateMany({
        where: { runId },
        data: { selected: false, selectionReason: null },
      })
    : { count: 0 }

  if (selected.length === 0) {
    return { clearedCount: clearResult.count, selected: [] }
  }

  const selectedRecords = await Promise.all(
    selected.map((candidate) =>
      prisma.aiNewsCandidate.update({
        where: { id: candidate.id },
        data: {
          selected: true,
          selectionReason: candidate.selectionReason ?? null,
        },
      }),
    ),
  )

  return { clearedCount: clearResult.count, selected: selectedRecords }
}

/**
 * 批量标记候选项的重复关系。
 */
export async function markAiNewsCandidateDuplicates({
  prisma,
  duplicates,
}: {
  prisma: AiNewsCandidateRepository
  duplicates: MarkAiNewsCandidateDuplicateInput[]
}): Promise<MarkAiNewsCandidateDuplicatesResult> {
  const updated: AiNewsCandidateRecord[] = []
  const failures: MarkAiNewsCandidateDuplicatesResult["failures"] = []

  for (const duplicate of duplicates) {
    try {
      updated.push(
        await prisma.aiNewsCandidate.update({
          where: { id: duplicate.id },
          data: { duplicateOfId: duplicate.duplicateOfId },
        }),
      )
    } catch (error) {
      failures.push({ id: duplicate.id, error: toError(error) })
    }
  }

  return { updated, failures }
}

/**
 * 批量回写候选项的富化结果（如事实卡、合并来源等）。
 */
export async function updateAiNewsCandidateEnrichments({
  prisma,
  enrichments,
}: {
  prisma: AiNewsCandidateRepository
  enrichments: UpdateAiNewsCandidateEnrichmentInput[]
}): Promise<UpdateAiNewsCandidateEnrichmentsResult> {
  const updated: AiNewsCandidateRecord[] = []
  const failures: UpdateAiNewsCandidateEnrichmentsResult["failures"] = []

  for (const enrichment of enrichments) {
    try {
      updated.push(
        await prisma.aiNewsCandidate.update({
          where: { id: enrichment.id },
          data: { enrichment: toPrismaJson(enrichment.enrichment) },
        }),
      )
    } catch (error) {
      failures.push({ id: enrichment.id, error: toError(error) })
    }
  }

  return { updated, failures }
}

/**
 * 查询某次运行的候选项列表，供后台候选详情面板使用。
 */
export async function listAiNewsRunCandidates({
  prisma,
  runId,
  selectedOnly = false,
}: {
  prisma: AiNewsCandidateRepository
  runId: string
  selectedOnly?: boolean
}) {
  return prisma.aiNewsCandidate.findMany({
    where: selectedOnly ? { runId, selected: true } : { runId },
    orderBy: [{ selected: "desc" }, { aiScore: "desc" }, { publishedAt: "desc" }],
  })
}
