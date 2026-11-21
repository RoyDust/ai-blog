import {
  DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS,
  DEFAULT_EXTERNAL_CONTENT_BUDGET_MS,
  ReliabilityError,
} from "@/lib/external-reliability"
import { ExternalContentClient, type ExternalContentClientLike } from "@/lib/external-content-client"
import { validateOutboundUrl, type SsrfGuardOptions } from "@/lib/ssrf-guard"
/**
 * AI 日报抓取器集合。
 *
 * 职责：
 * - 从 RSS / Atom、Hacker News、GitHub Releases 等来源抓取原始新闻项
 * - 把不同来源格式统一映射成 AiNewsRawItem
 * - 在抓取失败时产出结构化 failure，供运行日志展示
 */
import type { AiNewsRawItem, AiNewsSourceConfig, AiNewsSourceFailure } from "@/lib/ai-news/types"

type FetchAiNewsRawItemsOptions = SsrfGuardOptions & {
  sources: AiNewsSourceConfig[]
  since: Date
  fetchImpl?: typeof fetch
  timeoutMs?: number
  maxAttempts?: number
}

type HackerNewsItem = {
  id?: number
  by?: string
  descendants?: number
  kids?: number[]
  score?: number
  text?: string
  time?: number
  title?: string
  type?: string
  url?: string
}

type GitHubRelease = {
  id?: number
  html_url?: string
  tag_name?: string
  name?: string | null
  body?: string | null
  published_at?: string | null
  author?: {
    login?: string
  } | null
}

const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"])
const HACKER_NEWS_API_BASE = "https://hacker-news.firebaseio.com/v0"
const HACKER_NEWS_DISCUSSION_BASE = "https://news.ycombinator.com/item?id="
const HACKER_NEWS_MAX_CONCURRENCY = 6
const DEFAULT_USER_AGENT = "Inkforge-AiNews/1.0"
const SAFE_GITHUB_IDENTIFIER = /^[A-Za-z0-9._-]+$/

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
  const alternate = block.match(/<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*>/i)
  if (alternate?.[1]) return xmlDecode(alternate[1]).trim()

  const match = block.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/i)
  return match?.[1] ? xmlDecode(match[1]).trim() : ""
}

function readBlocks(xml: string, tagName: string) {
  return Array.from(xml.matchAll(new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\/${tagName}>`, "gi"))).map((match) => match[1] ?? "")
}

function parseDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function normalizeExcerpt(value: string) {
  return stripTags(value).slice(0, 360)
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function getSourceConfig(source: AiNewsSourceConfig) {
  return source.config && typeof source.config === "object" && !Array.isArray(source.config) ? source.config : {}
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runners = Array.from({ length: limit }, async () => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) break
      results[current] = await worker(items[current]!, current)
    }
  })

  await Promise.all(runners)
  return results
}

function formatHttpReliabilityError(error: unknown, label: string): never {
  if (error instanceof ReliabilityError && typeof error.status === "number") {
    throw new Error(`${label} HTTP ${error.status}`)
  }
  throw error
}

/**
 * 对抓取阶段的 URL 做轻量规范化，便于生成稳定 item id 与 canonicalUrl。
 */
export function canonicalizeAiNewsFetcherUrl(value: string) {
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
  return `${sourceId}:${canonicalizeAiNewsFetcherUrl(url) || title.toLowerCase()}`
}

function createFailure(source: AiNewsSourceConfig, stage: AiNewsSourceFailure["stage"], error: unknown): AiNewsSourceFailure {
  return {
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    url: source.url,
    stage,
    message: error instanceof Error ? error.message : String(error || "Unknown AI news source error"),
  }
}

/**
 * 解析 RSS / Atom feed，并映射为统一的原始候选项结构。
 */
export function parseAiNewsFeed(xml: string, source: AiNewsSourceConfig): AiNewsRawItem[] {
  const rssItems = readBlocks(xml, "item").map((block) => {
    const title = stripTags(readTag(block, "title"))
    const url = readTag(block, "link") || readTag(block, "guid")
    const summary = normalizeExcerpt(readTag(block, "description") || readTag(block, "content:encoded"))
    const publishedAt = parseDate(readTag(block, "pubDate") || readTag(block, "dc:date"))
    const author = stripTags(readTag(block, "author") || readTag(block, "dc:creator"))
    return { title, url, summary, publishedAt, author }
  })

  const atomItems = readBlocks(xml, "entry").map((block) => {
    const title = stripTags(readTag(block, "title"))
    const url = readAtomHref(block) || readTag(block, "id")
    const summary = normalizeExcerpt(readTag(block, "summary") || readTag(block, "content"))
    const publishedAt = parseDate(readTag(block, "updated") || readTag(block, "published"))
    const author = stripTags(readTag(readTag(block, "author"), "name"))
    return { title, url, summary, publishedAt, author }
  })

  return [...rssItems, ...atomItems]
    .filter((item) => item.title && item.url)
    .map((item) => ({
      id: makeItemId(source.id, item.url, item.title),
      sourceId: source.id,
      sourceType: source.type,
      sourceName: source.name,
      title: item.title,
      url: item.url,
      canonicalUrl: canonicalizeAiNewsFetcherUrl(item.url),
      summary: item.summary,
      author: item.author || null,
      publishedAt: item.publishedAt,
      metadata: { homepage: source.homepage ?? null, category: source.category ?? null },
    }))
}

async function fetchRssItems(source: AiNewsSourceConfig, client: ExternalContentClientLike) {
  try {
    const xml = await client.getText(source.url, {
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": DEFAULT_USER_AGENT,
      },
    })
    return parseAiNewsFeed(xml, source)
  } catch (error) {
    formatHttpReliabilityError(error, source.name)
  }
}

function buildHackerNewsDiscussionUrl(id: number) {
  return `${HACKER_NEWS_DISCUSSION_BASE}${id}`
}

async function fetchHackerNewsComment({
  apiBase,
  commentId,
  client,
  maxLength,
}: {
  apiBase: string
  commentId: number
  client: ExternalContentClientLike
  maxLength: number
}) {
  if (!Number.isInteger(commentId) || commentId < 0) {
    return null
  }
  try {
    const item = await client.getJson<HackerNewsItem | null>(`${apiBase}/item/${commentId}.json`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    })
    const text = stripTags(readString(item?.text))
    return text ? text.slice(0, maxLength) : null
  } catch (error) {
    formatHttpReliabilityError(error, `Hacker News comment ${commentId}`)
  }
}

async function fetchHackerNewsItems(
  source: AiNewsSourceConfig,
  since: Date,
  client: ExternalContentClientLike,
  ssrfOptions?: SsrfGuardOptions,
) {
  const config = getSourceConfig(source)
  const rawApiBase = (readString(config.apiBase) || HACKER_NEWS_API_BASE).replace(/\/+$/, "")
  validateOutboundUrl(rawApiBase, ssrfOptions)
  const fetchLimit = source.fetchLimit ?? readNumber(config.fetchLimit, 30)
  const minScore = source.minScore ?? readNumber(config.minScore, 0)
  const commentLimit = Math.max(0, readNumber(config.commentLimit, 3))
  const commentTextMaxLength = Math.max(1, readNumber(config.commentTextMaxLength, 500))

  let topStoriesPayload: unknown
  try {
    topStoriesPayload = await client.getJson<unknown>(`${rawApiBase}/topstories.json`, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    })
  } catch (error) {
    formatHttpReliabilityError(error, "Hacker News topstories")
  }

  const topStoryIds = (Array.isArray(topStoriesPayload) ? topStoriesPayload : [])
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id >= 0)
    .slice(0, fetchLimit)

  const items = await mapWithConcurrency(topStoryIds, HACKER_NEWS_MAX_CONCURRENCY, async (id) => {
    try {
      return await client.getJson<HackerNewsItem | null>(`${rawApiBase}/item/${id}.json`, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
      })
    } catch (error) {
      formatHttpReliabilityError(error, `Hacker News item ${id}`)
    }
  })

  const rawItems: AiNewsRawItem[] = []
  for (const item of items) {
    const id = item?.id
    const title = readString(item?.title)
    const score = readNumber(item?.score, 0)
    const publishedAt = item?.time ? new Date(item.time * 1000) : null
    if (!id || !title || score < minScore || (publishedAt && publishedAt < since)) continue

    const discussionUrl = buildHackerNewsDiscussionUrl(id)
    const commentIds = (item.kids ?? [])
      .filter((commentId): commentId is number => typeof commentId === "number" && Number.isInteger(commentId) && commentId >= 0)
      .slice(0, commentLimit)
    const comments = commentLimit > 0
      ? (
          await mapWithConcurrency(commentIds, HACKER_NEWS_MAX_CONCURRENCY, (commentId) =>
            fetchHackerNewsComment({ apiBase: rawApiBase, commentId, client, maxLength: commentTextMaxLength }),
          )
        ).filter((comment): comment is string => Boolean(comment))
      : []
    const url = readString(item.url) || discussionUrl

    rawItems.push({
      id: `${source.id}:${id}`,
      sourceId: source.id,
      sourceType: source.type,
      sourceName: source.name,
      title,
      url,
      canonicalUrl: canonicalizeAiNewsFetcherUrl(url),
      summary: comments[0] ?? null,
      author: readString(item.by) || null,
      publishedAt,
      metadata: {
        hnId: id,
        discussionUrl,
        itemType: item.type ?? null,
      },
      community: {
        score,
        commentCount: readNumber(item.descendants, item.kids?.length ?? 0),
        discussionUrl,
        comments,
      },
    })
  }

  return rawItems
}

function isSafeGitHubSlug(value: string): boolean {
  return Boolean(value) && value !== "." && value !== ".." && SAFE_GITHUB_IDENTIFIER.test(value)
}

function parseGitHubOwnerRepo(source: AiNewsSourceConfig, ssrfOptions?: SsrfGuardOptions) {
  if (source.url) {
    validateOutboundUrl(source.url, ssrfOptions)
  }
  const config = getSourceConfig(source)
  const owner = readString(config.owner)
  const repo = readString(config.repo)
  if (owner && repo) {
    if (!isSafeGitHubSlug(owner) || !isSafeGitHubSlug(repo)) {
      throw new Error("GitHub releases source has invalid owner or repo identifier")
    }
    return { owner, repo }
  }

  try {
    const url = validateOutboundUrl(source.url, ssrfOptions)
    const hostname = url.hostname.toLowerCase()
    if (hostname !== "github.com" && hostname !== "www.github.com") {
      throw new Error("Not GitHub")
    }
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\/|$)/)
    const parsedOwner = match?.[1] ?? ""
    const parsedRepo = (match?.[2] ?? "").replace(/\.git$/, "")
    if (isSafeGitHubSlug(parsedOwner) && isSafeGitHubSlug(parsedRepo)) {
      return { owner: parsedOwner, repo: parsedRepo }
    }
  } catch {
    // Fall through to structured error below.
  }

  throw new Error("GitHub releases source requires config.owner/config.repo or a GitHub repository URL")
}

async function fetchGitHubReleaseItems(
  source: AiNewsSourceConfig,
  since: Date,
  client: ExternalContentClientLike,
  ssrfOptions?: SsrfGuardOptions,
) {
  const { owner, repo } = parseGitHubOwnerRepo(source, ssrfOptions)
  const config = getSourceConfig(source)
  const fetchLimit = source.fetchLimit ?? readNumber(config.fetchLimit, 30)
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": DEFAULT_USER_AGENT,
    "X-GitHub-Api-Version": "2022-11-28",
  }
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  }

  let releases: GitHubRelease[]
  try {
    releases = await client.getJson<GitHubRelease[]>(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=${fetchLimit}`,
      { headers, maxAttempts: 1 },
    )
  } catch (error) {
    if (error instanceof ReliabilityError && typeof error.status === "number") {
      return fetchGitHubReleaseAtomItems({ source, since, client, owner, repo, originalStatus: error.status })
    }
    throw error
  }

  return (Array.isArray(releases) ? releases : [])
    .map((release): AiNewsRawItem | null => {
      const publishedAt = parseDate(release.published_at)
      const url = readString(release.html_url)
      const tag = readString(release.tag_name)
      const title = readString(release.name) || tag
      if (!publishedAt || publishedAt < since || !url || !title) return null

      return {
        id: `${source.id}:${release.id ?? tag}`,
        sourceId: source.id,
        sourceType: source.type,
        sourceName: source.name,
        title: `${owner}/${repo} ${title}`,
        url,
        canonicalUrl: canonicalizeAiNewsFetcherUrl(url),
        summary: normalizeExcerpt(readString(release.body)),
        content: readString(release.body) || null,
        author: release.author?.login ?? null,
        publishedAt,
        metadata: {
          owner,
          repo,
          tag,
          releaseId: release.id ?? null,
        },
      }
    })
    .filter((item): item is AiNewsRawItem => Boolean(item))
}

async function fetchGitHubReleaseAtomItems({
  source,
  since,
  client,
  owner,
  repo,
  originalStatus,
}: {
  source: AiNewsSourceConfig
  since: Date
  client: ExternalContentClientLike
  owner: string
  repo: string
  originalStatus: number
}) {
  const atomUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases.atom`
  let xml: string
  try {
    xml = await client.getText(atomUrl, {
      headers: {
        Accept: "application/atom+xml, application/xml, text/xml",
        "User-Agent": DEFAULT_USER_AGENT,
      },
      maxAttempts: 1,
    })
  } catch (error) {
    if (error instanceof ReliabilityError && typeof error.status === "number") {
      throw new Error(`${source.name} GitHub releases HTTP ${originalStatus}; atom fallback HTTP ${error.status}`)
    }
    throw error
  }

  return parseAiNewsFeed(xml, {
    ...source,
    url: atomUrl,
    homepage: source.homepage ?? `https://github.com/${owner}/${repo}`,
    config: {
      ...(source.config ?? {}),
      owner,
      repo,
      fetchedVia: "github-releases-atom",
      apiStatus: originalStatus,
    },
  }).filter((item) => !item.publishedAt || item.publishedAt >= since)
}

async function fetchRedditItems(source: AiNewsSourceConfig) {
  const config = getSourceConfig(source)
  if (config.mockItems && Array.isArray(config.mockItems)) {
    return config.mockItems.filter((item): item is AiNewsRawItem => Boolean(item && typeof item === "object"))
  }

  throw new Error("Reddit fetcher is not enabled in the first-round AI news pipeline")
}

async function fetchSourceItems(
  source: AiNewsSourceConfig,
  since: Date,
  client: ExternalContentClientLike,
  ssrfOptions?: SsrfGuardOptions,
) {
  switch (source.type) {
    case "RSS":
    case "GITHUB_TRENDING_RSS":
      return fetchRssItems(source, client)
    case "HACKERNEWS":
      return fetchHackerNewsItems(source, since, client, ssrfOptions)
    case "GITHUB_RELEASES":
      return fetchGitHubReleaseItems(source, since, client, ssrfOptions)
    case "REDDIT":
      return fetchRedditItems(source)
    default:
      throw new Error(`Unsupported AI news source type: ${source.type satisfies never}`)
  }
}

/**
 * 抓取所有来源的原始新闻项。
 * 返回 items 与 failures，供上层编排器继续做去重、评分和富化。
 */
export async function fetchAiNewsRawItems({
  sources,
  since,
  fetchImpl,
  timeoutMs,
  maxAttempts,
  allowLoopback,
}: FetchAiNewsRawItemsOptions): Promise<{
  items: AiNewsRawItem[]
  failures: AiNewsSourceFailure[]
}> {
  const totalTimeoutMs = timeoutMs ?? DEFAULT_EXTERNAL_CONTENT_BUDGET_MS
  const attemptTimeoutMs = timeoutMs
    ? Math.min(timeoutMs, DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS)
    : DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS
  const client = new ExternalContentClient(
    {
      fetchImpl,
      allowLoopback,
    },
    {
      totalTimeoutMs,
      attemptTimeoutMs,
      ...(maxAttempts !== undefined ? { maxAttempts } : {}),
    },
  )

  const results = await Promise.all(
    sources
      .filter((source) => source.enabled !== false)
      .map(async (source) => {
        try {
          return { items: await fetchSourceItems(source, since, client, { allowLoopback }), failure: null }
        } catch (error) {
          return { items: [], failure: createFailure(source, "fetch", error) }
        }
      }),
  )

  return {
    items: results.flatMap((result) => result.items),
    failures: results.map((result) => result.failure).filter((failure): failure is AiNewsSourceFailure => Boolean(failure)),
  }
}
