import { ConflictError, NotFoundError, ValidationError, isPrismaMissingSchemaError } from "@/lib/api-errors"
import { fetchAiNewsRawItems } from "@/lib/ai-news-fetchers"
import type { AiNewsJsonObject, AiNewsRawItem, AiNewsSourceConfig, AiNewsSourceType } from "@/lib/ai-news-types"
import { prisma } from "@/lib/prisma"

type AiNewsSourceRecord = {
  id: string
  type: AiNewsSourceType
  name: string
  url: string
  homepage: string | null
  category: string | null
  enabled: boolean
  weight: number
  minScore: number | null
  fetchLimit: number | null
  config: unknown
  lastTestedAt?: Date | null
  lastTestStatus?: string | null
  lastTestMessage?: string | null
  lastFetchedItemCount?: number | null
  createdAt?: Date
  updatedAt?: Date
}

type AiNewsRunRecord = {
  id: string
  sourceFailureJson?: unknown
}

type AiNewsCandidateRecord = {
  sourceId: string | null
  selected: boolean
}

type AiNewsSourceDelegate = {
  findMany: (args?: unknown) => Promise<AiNewsSourceRecord[]>
  findUnique: (args: { where: { id: string } }) => Promise<AiNewsSourceRecord | null>
  findFirst: (args: unknown) => Promise<AiNewsSourceRecord | null>
  count?: (args?: unknown) => Promise<number>
  create: (args: { data: Record<string, unknown> }) => Promise<AiNewsSourceRecord>
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<AiNewsSourceRecord>
  delete: (args: { where: { id: string } }) => Promise<unknown>
}

type AiNewsCandidateDelegate = {
  count?: (args: unknown) => Promise<number>
  findMany?: (args: unknown) => Promise<AiNewsCandidateRecord[]>
}

type AiNewsRunDelegate = {
  findMany?: (args: unknown) => Promise<AiNewsRunRecord[]>
}

type AiNewsSourceAdminClient = {
  aiNewsSource?: AiNewsSourceDelegate
  aiNewsCandidate?: AiNewsCandidateDelegate
  aiNewsRun?: AiNewsRunDelegate
}

export type PublicAiNewsSource = ReturnType<typeof toPublicAiNewsSource>

type AiNewsSourceMutationInput = {
  type?: unknown
  name?: unknown
  url?: unknown
  homepage?: unknown
  category?: unknown
  enabled?: unknown
  weight?: unknown
  minScore?: unknown
  fetchLimit?: unknown
  settings?: unknown
}

type AiNewsSourceStats = {
  recentRunCount: number
  recentCandidateCount: number
  recentSelectedCount: number
  recentFailureCount: number
}

type AiNewsSourceTestOptions = {
  fetchImpl?: typeof fetch
  now?: Date
  timeoutMs?: number
}

type AiNewsSourceListOptions = {
  page?: number
  limit?: number
  query?: string | null
  category?: string | null
}

type AiNewsSourcePagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

const SOURCE_TYPES: AiNewsSourceType[] = ["RSS", "HACKERNEWS", "GITHUB_RELEASES", "GITHUB_TRENDING_RSS", "REDDIT"]
const CREATEABLE_SOURCE_TYPES = new Set<AiNewsSourceType>(["RSS", "HACKERNEWS", "GITHUB_RELEASES", "GITHUB_TRENDING_RSS"])
const BUILT_IN_AI_NEWS_SOURCE_IDS = new Set([
  "openai",
  "anthropic",
  "google-ai",
  "meta-ai",
  "hugging-face",
  "techcrunch-ai",
  "venturebeat-ai",
  "the-decoder",
  "hackernews-top",
  "github-openai-node",
  "github-anthropic-sdk-typescript",
  "github-vercel-ai",
  "github-langchainjs",
  "github-transformers",
  "github-vllm",
  "github-llama-cpp",
])

const TEST_WINDOW_MS = 48 * 60 * 60 * 1000
const DEFAULT_SOURCE_TEST_TIMEOUT_MS = 12_000

function getClient(client: AiNewsSourceAdminClient = prisma as unknown as AiNewsSourceAdminClient) {
  return client
}

function getAiNewsSourceDelegate(client?: AiNewsSourceAdminClient) {
  const delegate = getClient(client).aiNewsSource
  if (!delegate) {
    throw new ValidationError("AI news source storage is not ready. Regenerate Prisma Client and restart the server.")
  }

  return delegate
}

function storageNotReadyError(error: unknown) {
  if (isPrismaMissingSchemaError(error)) {
    return new ValidationError("AI news source storage is not ready. Apply the AI news source database migration first.")
  }

  return null
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readOptionalString(value: unknown) {
  const text = readString(value)
  return text || null
}

function normalizePage(value: unknown) {
  const page = typeof value === "number" ? value : Number(value)
  return Number.isInteger(page) && page > 0 ? page : 1
}

function normalizeLimit(value: unknown) {
  const limit = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(limit) || limit <= 0) return 10

  return Math.min(limit, 100)
}

function readBoolean(value: unknown, fallback: boolean) {
  if (value == null) return fallback
  if (typeof value !== "boolean") throw new ValidationError("Invalid enabled flag")
  return value
}

function readInteger(value: unknown, field: string, fallback: number | null, min: number, max: number) {
  if (value == null || value === "") return fallback
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new ValidationError(`${field} must be an integer between ${min} and ${max}`)
  }

  return number
}

function readSourceType(value: unknown, fallback?: AiNewsSourceType) {
  if (value == null || value === "") {
    if (fallback) return fallback
    throw new ValidationError("Source type is required")
  }

  if (typeof value !== "string" || !SOURCE_TYPES.includes(value as AiNewsSourceType)) {
    throw new ValidationError("Invalid AI news source type")
  }

  return value as AiNewsSourceType
}

function readJsonObject(value: unknown): AiNewsJsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as AiNewsJsonObject) : {}
}

function validateUrl(value: string, field: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported protocol")
    }

    url.hash = ""
    return url.toString()
  } catch {
    throw new ValidationError(`${field} must be a valid http(s) URL`)
  }
}

function normalizeHomepage(value: unknown) {
  const homepage = readOptionalString(value)
  return homepage ? validateUrl(homepage, "Homepage") : null
}

function normalizeCategory(value: unknown) {
  const category = readOptionalString(value)
  return category ? category.slice(0, 60) : null
}

function normalizeSourceName(value: unknown, fallback?: string) {
  const name = readString(value) || fallback || ""
  if (name.length < 2 || name.length > 80) {
    throw new ValidationError("Source name must be between 2 and 80 characters")
  }

  return name
}

function slugifySourceName(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return slug || "source"
}

async function createUniqueSourceId(delegate: AiNewsSourceDelegate, name: string) {
  const base = slugifySourceName(name)
  let candidate = base
  let suffix = 2

  while (await delegate.findUnique({ where: { id: candidate } })) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function parseGitHubOwnerRepo(urlValue: string) {
  try {
    const url = new URL(urlValue)
    if (!url.hostname.toLowerCase().endsWith("github.com")) {
      throw new Error("Not GitHub")
    }
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\/|$)/)
    if (!match?.[1] || !match[2]) {
      throw new Error("Missing owner/repo")
    }

    return { owner: match[1], repo: match[2].replace(/\.git$/, "") }
  } catch {
    throw new ValidationError("GitHub releases source requires a valid GitHub repository URL")
  }
}

function normalizeSettingsForStorage(type: AiNewsSourceType, url: string, settingsValue: unknown, existingConfig?: unknown) {
  const settings = readJsonObject(settingsValue)
  const existing = readJsonObject(existingConfig)

  if (type === "GITHUB_RELEASES") {
    return {
      ...existing,
      ...parseGitHubOwnerRepo(url),
    }
  }

  if (type === "HACKERNEWS") {
    const commentLimit = readInteger(settings.commentLimit, "commentLimit", readInteger(existing.commentLimit, "commentLimit", 3, 0, 20), 0, 20)
    const commentTextMaxLength = readInteger(
      settings.commentTextMaxLength,
      "commentTextMaxLength",
      readInteger(existing.commentTextMaxLength, "commentTextMaxLength", 500, 80, 2000),
      80,
      2000,
    )
    const apiBase = readOptionalString(settings.apiBase) ?? readOptionalString(existing.apiBase)

    return {
      ...(apiBase ? { apiBase: validateUrl(apiBase, "Hacker News API base").replace(/\/+$/, "") } : {}),
      commentLimit,
      commentTextMaxLength,
    }
  }

  return Object.keys(existing).length > 0 ? existing : null
}

function normalizeCreateInput(input: AiNewsSourceMutationInput) {
  const type = readSourceType(input.type)
  if (!CREATEABLE_SOURCE_TYPES.has(type)) {
    throw new ValidationError("This AI news source type is not available for creation yet")
  }

  const name = normalizeSourceName(input.name)
  const url = validateUrl(type === "HACKERNEWS" && !readString(input.url) ? "https://news.ycombinator.com/" : readString(input.url), "Source URL")
  const weight = readInteger(input.weight, "weight", 50, 0, 200)
  const minScore = readInteger(input.minScore, "minScore", null, 0, 10000)
  const fetchLimit = readInteger(input.fetchLimit, "fetchLimit", null, 1, 100)

  return {
    type,
    name,
    url,
    homepage: normalizeHomepage(input.homepage),
    category: normalizeCategory(input.category),
    enabled: readBoolean(input.enabled, true),
    weight,
    minScore,
    fetchLimit,
    config: normalizeSettingsForStorage(type, url, input.settings),
  }
}

function normalizeUpdateInput(existing: AiNewsSourceRecord, input: AiNewsSourceMutationInput) {
  if (input.type != null && input.type !== existing.type) {
    throw new ValidationError("Source type cannot be changed. Delete and recreate the source instead.")
  }

  const name = input.name === undefined ? existing.name : normalizeSourceName(input.name, existing.name)
  const url = input.url === undefined ? existing.url : validateUrl(readString(input.url), "Source URL")
  const data: Record<string, unknown> = {
    name,
    url,
    homepage: input.homepage === undefined ? existing.homepage : normalizeHomepage(input.homepage),
    category: input.category === undefined ? existing.category : normalizeCategory(input.category),
    enabled: input.enabled === undefined ? existing.enabled : readBoolean(input.enabled, existing.enabled),
    weight: input.weight === undefined ? existing.weight : readInteger(input.weight, "weight", existing.weight, 0, 200),
    minScore: input.minScore === undefined ? existing.minScore : readInteger(input.minScore, "minScore", null, 0, 10000),
    fetchLimit: input.fetchLimit === undefined ? existing.fetchLimit : readInteger(input.fetchLimit, "fetchLimit", null, 1, 100),
  }

  if (input.settings !== undefined || (existing.type === "GITHUB_RELEASES" && input.url !== undefined)) {
    data.config = normalizeSettingsForStorage(existing.type, url, input.settings, existing.config)
  }

  return data
}

function sourceRecordToConfig(source: AiNewsSourceRecord): AiNewsSourceConfig {
  return {
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    homepage: source.homepage,
    category: source.category,
    enabled: source.enabled,
    weight: source.weight,
    minScore: source.minScore,
    fetchLimit: source.fetchLimit,
    config: readJsonObject(source.config),
  }
}

function settingsFromSource(source: AiNewsSourceRecord) {
  const config = readJsonObject(source.config)

  if (source.type === "GITHUB_RELEASES") {
    return {
      owner: readString(config.owner),
      repo: readString(config.repo),
    }
  }

  if (source.type === "HACKERNEWS") {
    return {
      apiBase: readOptionalString(config.apiBase),
      commentLimit: typeof config.commentLimit === "number" ? config.commentLimit : null,
      commentTextMaxLength: typeof config.commentTextMaxLength === "number" ? config.commentTextMaxLength : null,
    }
  }

  return {}
}

function sourceWarnings(source: AiNewsSourceRecord, stats: AiNewsSourceStats) {
  const warnings: string[] = []
  if (source.lastTestStatus === "failed") {
    warnings.push("最近测试失败")
  }
  if (stats.recentFailureCount >= 3) {
    warnings.push("近 20 次运行失败较多")
  }
  if (stats.recentCandidateCount >= 5 && stats.recentSelectedCount === 0) {
    warnings.push("近 20 次有候选但未入选")
  }

  return warnings
}

export function toPublicAiNewsSource(source: AiNewsSourceRecord, stats: AiNewsSourceStats = {
  recentRunCount: 0,
  recentCandidateCount: 0,
  recentSelectedCount: 0,
  recentFailureCount: 0,
}) {
  const deletable = !BUILT_IN_AI_NEWS_SOURCE_IDS.has(source.id)

  return {
    id: source.id,
    type: source.type,
    name: source.name,
    url: source.url,
    homepage: source.homepage,
    category: source.category,
    enabled: source.enabled,
    weight: source.weight,
    minScore: source.minScore,
    fetchLimit: source.fetchLimit,
    settings: settingsFromSource(source),
    editable: true,
    deletable,
    lastTestedAt: source.lastTestedAt ?? null,
    lastTestStatus: source.lastTestStatus ?? null,
    lastTestMessage: source.lastTestMessage ?? null,
    lastFetchedItemCount: source.lastFetchedItemCount ?? null,
    stats,
    healthWarnings: sourceWarnings(source, stats),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  }
}

function emptyStats(): AiNewsSourceStats {
  return {
    recentRunCount: 0,
    recentCandidateCount: 0,
    recentSelectedCount: 0,
    recentFailureCount: 0,
  }
}

function buildSourceListWhere(options: Pick<AiNewsSourceListOptions, "query" | "category">) {
  const where: Record<string, unknown> = {}
  const query = readOptionalString(options.query)
  const category = readOptionalString(options.category)

  if (category && category !== "all") {
    where.category = category
  }

  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { url: { contains: query, mode: "insensitive" } },
      { category: { contains: query, mode: "insensitive" } },
    ]
  }

  return where
}

async function countAiNewsSources(delegate: AiNewsSourceDelegate, args?: unknown) {
  if (typeof delegate.count === "function") {
    return delegate.count(args)
  }

  return (await delegate.findMany(args)).length
}

function buildSourcePagination({ page, limit, total }: { page: number; limit: number; total: number }): AiNewsSourcePagination {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const activePage = Math.min(page, totalPages)

  return {
    page: activePage,
    limit,
    total,
    totalPages,
  }
}

function readFailureSourceId(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof (value as { sourceId?: unknown }).sourceId === "string"
    ? (value as { sourceId: string }).sourceId
    : null
}

async function loadRecentSourceStats(client: AiNewsSourceAdminClient) {
  const runDelegate = client.aiNewsRun
  const candidateDelegate = client.aiNewsCandidate
  const stats = new Map<string, AiNewsSourceStats>()

  if (!runDelegate?.findMany) {
    return stats
  }

  const runs = await runDelegate.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, sourceFailureJson: true },
  })
  const runIds = runs.map((run) => run.id)

  for (const run of runs) {
    const failures = Array.isArray(run.sourceFailureJson) ? run.sourceFailureJson : []
    for (const failure of failures) {
      const sourceId = readFailureSourceId(failure)
      if (!sourceId) continue
      const next = stats.get(sourceId) ?? emptyStats()
      next.recentRunCount = runs.length
      next.recentFailureCount += 1
      stats.set(sourceId, next)
    }
  }

  if (runIds.length === 0 || !candidateDelegate?.findMany) {
    return stats
  }

  const candidates = await candidateDelegate.findMany({
    where: { runId: { in: runIds } },
    select: { sourceId: true, selected: true },
  })

  for (const candidate of candidates) {
    if (!candidate.sourceId) continue
    const next = stats.get(candidate.sourceId) ?? emptyStats()
    next.recentRunCount = runs.length
    next.recentCandidateCount += 1
    if (candidate.selected) {
      next.recentSelectedCount += 1
    }
    stats.set(candidate.sourceId, next)
  }

  return stats
}

export async function listAiNewsSources(options: AiNewsSourceListOptions = {}, client?: AiNewsSourceAdminClient) {
  const resolvedClient = getClient(client)
  const delegate = getAiNewsSourceDelegate(resolvedClient)
  const page = normalizePage(options.page)
  const limit = normalizeLimit(options.limit)
  const where = buildSourceListWhere(options)

  try {
    const total = await countAiNewsSources(delegate, { where })
    const pagination = buildSourcePagination({ page, limit, total })
    const [sources, stats, enabledSourceRows, enabledCount] = await Promise.all([
      delegate.findMany({
        where,
        orderBy: [{ enabled: "desc" }, { weight: "desc" }, { name: "asc" }],
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      loadRecentSourceStats(resolvedClient),
      delegate.findMany({
        where: { enabled: true },
        orderBy: [{ weight: "desc" }, { name: "asc" }],
        select: { id: true },
      }),
      countAiNewsSources(delegate, { where: { enabled: true } }),
    ])

    return {
      sources: sources.map((source) => toPublicAiNewsSource(source, stats.get(source.id) ?? emptyStats())),
      pagination,
      summary: {
        enabledCount,
        enabledSourceIds: enabledSourceRows.map((source) => source.id),
      },
    }
  } catch (error) {
    throw storageNotReadyError(error) ?? error
  }
}

export async function createAiNewsSource(input: AiNewsSourceMutationInput, client?: AiNewsSourceAdminClient) {
  const delegate = getAiNewsSourceDelegate(client)
  const normalized = normalizeCreateInput(input)

  try {
    const duplicate = await delegate.findFirst({ where: { url: normalized.url } })
    if (duplicate) {
      throw new ConflictError("AI news source URL already exists")
    }

    const id = await createUniqueSourceId(delegate, normalized.name)
    const source = await delegate.create({
      data: {
        id,
        ...normalized,
      },
    })

    return toPublicAiNewsSource(source)
  } catch (error) {
    throw storageNotReadyError(error) ?? error
  }
}

export async function updateAiNewsSource(id: string, input: AiNewsSourceMutationInput, client?: AiNewsSourceAdminClient) {
  const delegate = getAiNewsSourceDelegate(client)
  const existing = await delegate.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError("AI news source not found")
  }

  const normalized = normalizeUpdateInput(existing, input)

  try {
    if (typeof normalized.url === "string" && normalized.url !== existing.url) {
      const duplicate = await delegate.findFirst({ where: { url: normalized.url, id: { not: id } } })
      if (duplicate) {
        throw new ConflictError("AI news source URL already exists")
      }
    }

    const source = await delegate.update({ where: { id }, data: normalized })
    return toPublicAiNewsSource(source)
  } catch (error) {
    throw storageNotReadyError(error) ?? error
  }
}

export async function deleteAiNewsSource(id: string, client?: AiNewsSourceAdminClient) {
  const resolvedClient = getClient(client)
  const delegate = getAiNewsSourceDelegate(resolvedClient)
  const existing = await delegate.findUnique({ where: { id } })
  if (!existing) {
    throw new NotFoundError("AI news source not found")
  }

  if (BUILT_IN_AI_NEWS_SOURCE_IDS.has(id)) {
    throw new ValidationError("Built-in AI news sources cannot be deleted. Disable the source instead.")
  }

  try {
    await resolvedClient.aiNewsCandidate?.count?.({ where: { sourceId: id } })
    await delegate.delete({ where: { id } })
  } catch (error) {
    throw storageNotReadyError(error) ?? error
  }
}

function withFetchTimeout(fetchImpl: typeof fetch, timeoutMs: number): typeof fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    return fetchImpl(input, { ...init, signal: init?.signal ?? controller.signal }).finally(() => clearTimeout(timer))
  }) as typeof fetch
}

function sourceTestMessage(status: "success" | "failed", itemCount: number, failures: string[]) {
  if (status === "success") {
    return `来源可用，最近 48 小时抓到 ${itemCount} 条候选。`
  }

  return failures.join("；") || "来源测试失败"
}

function sampleItems(items: AiNewsRawItem[]) {
  return items.slice(0, 3).map((item) => ({
    title: item.title,
    url: item.url,
  }))
}

export async function testAiNewsSource(id: string, options: AiNewsSourceTestOptions = {}, client?: AiNewsSourceAdminClient) {
  const delegate = getAiNewsSourceDelegate(client)
  const source = await delegate.findUnique({ where: { id } })
  if (!source) {
    throw new NotFoundError("AI news source not found")
  }

  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - TEST_WINDOW_MS)
  const fetchImpl = withFetchTimeout(options.fetchImpl ?? fetch, options.timeoutMs ?? DEFAULT_SOURCE_TEST_TIMEOUT_MS)
  const runtimeSource = { ...sourceRecordToConfig(source), enabled: true }
  const { items, failures } = await fetchAiNewsRawItems({ sources: [runtimeSource], since: cutoff, fetchImpl })
  const recentItems = items.filter((item) => !item.publishedAt || item.publishedAt >= cutoff)
  const failureMessages = failures.map((failure) => failure.message)
  const status = failures.length > 0 ? "failed" as const : "success" as const
  const message = sourceTestMessage(status, recentItems.length, failureMessages)

  await delegate.update({
    where: { id },
    data: {
      lastTestedAt: now,
      lastTestStatus: status,
      lastTestMessage: message,
      lastFetchedItemCount: recentItems.length,
    },
  })

  return {
    status,
    itemCount: recentItems.length,
    sampleItems: sampleItems(recentItems),
    message,
    testedAt: now,
  }
}
