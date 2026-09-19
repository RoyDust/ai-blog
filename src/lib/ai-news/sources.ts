import { DEFAULT_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"
import type { AiNewsJsonObject, AiNewsSourceConfig, AiNewsSourceType } from "@/lib/ai-news/types"

type DailyAiNewsSourceLoaderOptions = {
  prisma?: {
    aiNewsSource?: {
      findMany?: (args?: unknown) => Promise<unknown[]>
    }
  } | null
  fallback?: AiNewsSourceConfig[]
}

type SelectedAiNewsSourceLoaderOptions = {
  prisma?: {
    aiNewsSource?: {
      findMany?: (args?: unknown) => Promise<unknown[]>
    }
  } | null
  sourceIds: string[]
}

// 兜底清单收敛到 default-sources 后，这里按旧名再导出，保持既有消费方与测试兼容。
export { DEFAULT_AI_NEWS_SOURCES as FALLBACK_DAILY_AI_NEWS_SOURCES }


function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readNullableString(value: unknown) {
  const text = readString(value)
  return text || null
}

function readNumber(value: unknown, fallback?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function isSourceType(value: unknown): value is AiNewsSourceType {
  return value === "RSS" || value === "HACKERNEWS" || value === "GITHUB_RELEASES" || value === "GITHUB_TRENDING_RSS" || value === "REDDIT"
}

function readJsonObject(value: unknown): AiNewsJsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AiNewsJsonObject) : null
}

function mapDbSource(row: unknown): AiNewsSourceConfig | null {
  if (!row || typeof row !== "object") return null

  const record = row as Record<string, unknown>
  const id = readString(record.id)
  const name = readString(record.name)
  const url = readString(record.url)
  const type = isSourceType(record.type) ? record.type : null

  if (!id || !name || !url || !type) return null

  return {
    id,
    type,
    name,
    url,
    homepage: readNullableString(record.homepage),
    category: readNullableString(record.category),
    enabled: record.enabled !== false,
    weight: readNumber(record.weight, 1),
    minScore: readNumber(record.minScore, undefined) ?? null,
    fetchLimit: readNumber(record.fetchLimit, undefined) ?? null,
    config: readJsonObject(record.config),
  }
}

function sortSources(sources: AiNewsSourceConfig[]) {
  return [...sources].sort((a, b) => {
    const byWeight = (b.weight ?? 1) - (a.weight ?? 1)
    if (byWeight !== 0) return byWeight
    return a.name.localeCompare(b.name)
  })
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export async function loadDailyAiNewsSources({
  prisma,
  fallback = DEFAULT_AI_NEWS_SOURCES,
}: DailyAiNewsSourceLoaderOptions = {}): Promise<AiNewsSourceConfig[]> {
  const fallbackSources = sortSources(fallback)
  const findMany = prisma?.aiNewsSource?.findMany

  if (typeof findMany !== "function") {
    return fallbackSources
  }

  try {
    const rows = await findMany({
      where: { enabled: true },
      orderBy: [{ weight: "desc" }, { name: "asc" }],
    })
    const dbSources = sortSources(rows.map(mapDbSource).filter((source): source is AiNewsSourceConfig => Boolean(source)))
    return dbSources.length > 0 ? dbSources : fallbackSources
  } catch {
    return fallbackSources
  }
}

export async function loadSelectedDailyAiNewsSources({
  prisma,
  sourceIds,
}: SelectedAiNewsSourceLoaderOptions): Promise<{ sources: AiNewsSourceConfig[]; missingIds: string[] }> {
  const ids = uniqueStrings(sourceIds)
  const findMany = prisma?.aiNewsSource?.findMany

  if (ids.length === 0 || typeof findMany !== "function") {
    return { sources: [], missingIds: ids }
  }

  const rows = await findMany({
    where: { id: { in: ids } },
    orderBy: [{ weight: "desc" }, { name: "asc" }],
  })
  const sources = rows
    .map(mapDbSource)
    .filter((source): source is AiNewsSourceConfig => Boolean(source))
    .map((source) => ({
      ...source,
      defaultEnabled: source.enabled !== false,
      enabled: true,
    }))
  const foundIds = new Set(sources.map((source) => source.id))

  return {
    sources: sortSources(sources),
    missingIds: ids.filter((id) => !foundIds.has(id)),
  }
}
