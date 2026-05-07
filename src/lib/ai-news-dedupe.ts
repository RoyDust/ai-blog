/**
 * AI 日报去重模块。
 *
 * 职责：
 * - 先基于 canonical URL 做确定性去重
 * - 再在需要时调用模型做语义级去重
 * - 保留合并来源信息，避免去重后丢失多源上下文
 */
import type { AiNewsCandidateInput, AiNewsJsonObject, AiNewsRawItem } from "@/lib/ai-news-types"

type SemanticDedupeAiModel = {
  baseUrl: string
  requestPath: string
  model: string
  apiKey?: string
}

type SemanticDedupeInput = {
  candidates: AiNewsCandidateInput[]
  aiModel?: SemanticDedupeAiModel
  fetchImpl?: typeof fetch
}

type ChatCompletionPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string; type?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

export type AiNewsDuplicateMap = Record<string, string[]>

const TRACKING_PARAM_PREFIX = "utm_"
const TRACKING_PARAM_NAMES = new Set(["fbclid", "gclid"])

function normalizeTrailingSlash(value: string) {
  return value.replace(/\/+$/, "")
}

function isTrackingParam(key: string) {
  const normalized = key.toLowerCase()
  return normalized.startsWith(TRACKING_PARAM_PREFIX) || TRACKING_PARAM_NAMES.has(normalized)
}

function sortSearchParams(url: URL) {
  const sorted = Array.from(url.searchParams.entries())
    .filter(([key]) => !isTrackingParam(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyComparison = leftKey.localeCompare(rightKey)
      return keyComparison === 0 ? leftValue.localeCompare(rightValue) : keyComparison
    })

  url.search = ""
  for (const [key, value] of sorted) {
    url.searchParams.append(key, value)
  }
}

function canonicalizeInvalidUrl(value: string) {
  const withoutHash = value.trim().split("#", 1)[0] ?? ""
  const [path = "", query = ""] = withoutHash.split("?", 2)
  const params = new URLSearchParams(query)
  const sorted = Array.from(params.entries())
    .filter(([key]) => !isTrackingParam(key))
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => {
      const keyComparison = leftKey.localeCompare(rightKey)
      return keyComparison === 0 ? leftValue.localeCompare(rightValue) : keyComparison
    })

  const search = new URLSearchParams()
  for (const [key, value] of sorted) {
    search.append(key, value)
  }

  const normalizedPath = normalizeTrailingSlash(path.replace(/^https?:\/\/www\./i, "https://").replace(/^www\./i, "")).toLowerCase()
  const normalizedQuery = search.toString()

  return normalizedQuery ? `${normalizedPath}?${normalizedQuery}` : normalizedPath
}

/**
 * 规范化新闻 URL，去掉 hash、追踪参数和主机格式差异，作为去重主键基础。
 */
export function canonicalizeAiNewsUrl(url: string) {
  const trimmed = url.trim()
  if (!trimmed) return ""

  try {
    const parsed = new URL(trimmed)
    parsed.hash = ""
    parsed.protocol = parsed.protocol.toLowerCase()
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "")
    parsed.pathname = normalizeTrailingSlash(parsed.pathname) || "/"
    sortSearchParams(parsed)

    return normalizeTrailingSlash(parsed.toString())
  } catch {
    return canonicalizeInvalidUrl(trimmed)
  }
}

function sourceKey(source: NonNullable<AiNewsCandidateInput["mergedSources"]>[number]) {
  return [source.sourceId ?? "", source.sourceType, source.sourceName, source.url].join("\u0000")
}

function itemSource(item: AiNewsRawItem) {
  return {
    sourceId: item.sourceId,
    sourceType: item.sourceType,
    sourceName: item.sourceName,
    url: item.url,
  }
}

function collectMergedSources(...items: AiNewsCandidateInput[]) {
  const sources = new Map<string, NonNullable<AiNewsCandidateInput["mergedSources"]>[number]>()

  for (const item of items) {
    const itemSources = [itemSource(item), ...(item.mergedSources ?? [])]
    for (const source of itemSources) {
      sources.set(sourceKey(source), source)
    }
  }

  return Array.from(sources.values())
}

function objectScore(value: AiNewsJsonObject | null | undefined): number {
  if (!value) return 0

  return Object.values(value).reduce<number>((score, entry) => {
    if (typeof entry === "string") return score + entry.length
    if (Array.isArray(entry)) return score + entry.length * 20
    if (typeof entry === "object" && entry !== null) return score + Object.keys(entry).length * 10
    return score + 1
  }, 0)
}

function contentRichnessScore(item: AiNewsRawItem): number {
  return [
    item.title.length,
    item.summary?.length ?? 0,
    item.content?.length ?? 0,
    item.author ? 20 : 0,
    item.publishedAt ? 20 : 0,
    objectScore(item.metadata),
    objectScore(item.community),
  ].reduce<number>((sum, score) => sum + score, 0)
}

function mergeJsonObjects(
  primaryValue: AiNewsJsonObject | null | undefined,
  duplicateValue: AiNewsJsonObject | null | undefined,
) {
  if (!primaryValue && !duplicateValue) return primaryValue ?? duplicateValue
  return {
    ...(duplicateValue ?? {}),
    ...(primaryValue ?? {}),
  }
}

function mergeCandidate(primary: AiNewsCandidateInput, duplicate: AiNewsCandidateInput): AiNewsCandidateInput {
  return {
    ...primary,
    summary: primary.summary || duplicate.summary,
    content: primary.content || duplicate.content,
    author: primary.author || duplicate.author,
    publishedAt: primary.publishedAt ?? duplicate.publishedAt,
    metadata: mergeJsonObjects(primary.metadata, duplicate.metadata),
    community: mergeJsonObjects(primary.community, duplicate.community),
    mergedSources: collectMergedSources(primary, duplicate),
  }
}

function toCandidateInput(item: AiNewsRawItem): AiNewsCandidateInput {
  return {
    ...item,
    canonicalUrl: canonicalizeAiNewsUrl(item.canonicalUrl || item.url),
    mergedSources: [itemSource(item)],
  }
}

/**
 * 基于 canonical URL 合并重复候选。
 * 同 URL 冲突时，会优先保留内容信息更丰富的那条记录。
 */
export function dedupeByCanonicalUrl(items: AiNewsRawItem[]): AiNewsCandidateInput[] {
  const byCanonicalUrl = new Map<string, AiNewsCandidateInput>()

  for (const item of items) {
    const candidate = toCandidateInput(item)
    const existing = byCanonicalUrl.get(candidate.canonicalUrl)

    if (!existing) {
      byCanonicalUrl.set(candidate.canonicalUrl, candidate)
      continue
    }

    let primary = existing
    let duplicate = candidate
    if (contentRichnessScore(candidate) > contentRichnessScore(existing)) {
      primary = candidate
      duplicate = existing
    }

    byCanonicalUrl.set(candidate.canonicalUrl, mergeCandidate(primary, duplicate))
  }

  return Array.from(byCanonicalUrl.values())
}

function buildUrlDuplicateMap(candidates: AiNewsCandidateInput[]): AiNewsDuplicateMap {
  const groups = new Map<string, AiNewsCandidateInput[]>()

  for (const candidate of candidates) {
    const canonicalUrl = candidate.canonicalUrl || canonicalizeAiNewsUrl(candidate.url)
    groups.set(canonicalUrl, [...(groups.get(canonicalUrl) ?? []), candidate])
  }

  const duplicateMap: AiNewsDuplicateMap = {}
  for (const group of groups.values()) {
    if (group.length < 2) continue

    const sortedGroup = [...group].sort((left, right) => contentRichnessScore(right) - contentRichnessScore(left))
    const [primary, ...duplicates] = sortedGroup
    if (primary && duplicates.length > 0) {
      duplicateMap[primary.id] = duplicates.map((candidate) => candidate.id)
    }
  }

  return duplicateMap
}

function buildSemanticDedupePrompt(candidates: AiNewsCandidateInput[]) {
  const candidateDigest = candidates
    .map((candidate, index) => {
      return [
        `${index + 1}. id: ${candidate.id}`,
        `title: ${candidate.title}`,
        `source: ${candidate.sourceName} (${candidate.sourceType})`,
        `url: ${candidate.url}`,
        candidate.publishedAt ? `publishedAt: ${candidate.publishedAt.toISOString()}` : undefined,
        candidate.summary ? `summary: ${candidate.summary}` : undefined,
      ]
        .filter(Boolean)
        .join("\n")
    })
    .join("\n\n")

  return [
    "You deduplicate AI news candidates.",
    "Only mark candidates as duplicates when they report the same event or announcement.",
    "Do not merge different releases, dates, benchmark updates, funding events, launches, or follow-up analysis about the same product.",
    "When uncertain, keep both candidates by omitting them from duplicate groups.",
    "Return only JSON with this shape: {\"duplicateGroups\":[{\"primaryId\":\"candidate-id\",\"duplicateIds\":[\"candidate-id\"]}]}",
    `Candidates:\n${candidateDigest}`,
  ].join("\n\n")
}

function extractCompletionText(payload: ChatCompletionPayload) {
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

function readDuplicateGroups(parsed: unknown): unknown[] {
  if (!parsed || typeof parsed !== "object") return []

  const record = parsed as Record<string, unknown>
  if (Array.isArray(record.duplicateGroups)) return record.duplicateGroups
  if (Array.isArray(record.groups)) return record.groups
  if (Array.isArray(record.duplicates)) return record.duplicates
  if (record.duplicateMap && typeof record.duplicateMap === "object" && !Array.isArray(record.duplicateMap)) {
    return Object.entries(record.duplicateMap as Record<string, unknown>).map(([primaryId, duplicateIds]) => ({
      primaryId,
      duplicateIds,
    }))
  }

  if (Object.values(record).every((value) => Array.isArray(value))) {
    return Object.entries(record).map(([primaryId, duplicateIds]) => ({
      primaryId,
      duplicateIds,
    }))
  }

  return []
}

function readDuplicateIds(group: Record<string, unknown>) {
  const duplicateIds = group.duplicateIds ?? group.duplicates ?? group.duplicateOfIds
  return Array.isArray(duplicateIds) ? duplicateIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : []
}

function parseDuplicateMap(text: string, candidates: AiNewsCandidateInput[]): AiNewsDuplicateMap {
  const parsed = JSON.parse(stripJsonFence(text))
  const candidateIds = new Set(candidates.map((candidate) => candidate.id))
  const claimedIds = new Set<string>()
  const duplicateMap: AiNewsDuplicateMap = {}

  for (const group of readDuplicateGroups(parsed)) {
    if (Array.isArray(group)) {
      const [primaryId, ...duplicateIds] = group.filter((id): id is string => typeof id === "string")
      if (!primaryId) continue

      const uniqueDuplicateIds = Array.from(new Set(duplicateIds)).filter((id) => id !== primaryId)
      const isValidArrayGroup =
        candidateIds.has(primaryId) &&
        uniqueDuplicateIds.length > 0 &&
        uniqueDuplicateIds.every((id) => candidateIds.has(id)) &&
        !claimedIds.has(primaryId) &&
        uniqueDuplicateIds.every((id) => !claimedIds.has(id))

      if (!isValidArrayGroup) continue

      duplicateMap[primaryId] = uniqueDuplicateIds
      claimedIds.add(primaryId)
      for (const id of uniqueDuplicateIds) {
        claimedIds.add(id)
      }
      continue
    }

    if (!group || typeof group !== "object") continue

    const record = group as Record<string, unknown>
    const primaryId = typeof record.primaryId === "string" ? record.primaryId : ""
    const duplicateIds = readDuplicateIds(record)
    const uniqueDuplicateIds = Array.from(new Set(duplicateIds)).filter((id) => id !== primaryId)

    const isValidGroup =
      primaryId &&
      candidateIds.has(primaryId) &&
      uniqueDuplicateIds.length > 0 &&
      uniqueDuplicateIds.every((id) => candidateIds.has(id)) &&
      !claimedIds.has(primaryId) &&
      uniqueDuplicateIds.every((id) => !claimedIds.has(id))

    if (!isValidGroup) continue

    duplicateMap[primaryId] = uniqueDuplicateIds
    claimedIds.add(primaryId)
    for (const id of uniqueDuplicateIds) {
      claimedIds.add(id)
    }
  }

  return duplicateMap
}

/**
 * 基于模型做语义去重。
 * 仅在“可能是同一事件的不同来源报道”场景下使用，用于补足 URL 去重覆盖不到的情况。
 */
export async function semanticDedupeCandidates({
  candidates,
  aiModel,
  fetchImpl = fetch,
}: SemanticDedupeInput): Promise<AiNewsDuplicateMap> {
  const urlDuplicateMap = buildUrlDuplicateMap(candidates)
  if (candidates.length < 2 || !aiModel?.apiKey) return urlDuplicateMap

  try {
    const response = await fetchImpl(`${aiModel.baseUrl}${aiModel.requestPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiModel.apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel.model,
        messages: [
          { role: "system", content: "You are a conservative deduplication assistant. Return valid JSON only." },
          { role: "user", content: buildSemanticDedupePrompt(candidates) },
        ],
        temperature: 0,
        max_tokens: 1200,
      }),
    })

    const payload = (await response.json()) as ChatCompletionPayload
    if (!response.ok) {
      throw new Error(payload.error?.message || "AI semantic dedupe failed")
    }

    return parseDuplicateMap(extractCompletionText(payload), candidates)
  } catch {
    return urlDuplicateMap
  }
}
