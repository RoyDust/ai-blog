import { createAdminPost, publishAiDraftPost } from "@/lib/ai-authoring"
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

const MAX_CANDIDATES_FOR_AI = 20
const RECENT_WINDOW_MS = 48 * 60 * 60 * 1000
const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"])

function xmlDecode(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
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

export function buildDailyAiNewsSlug(date: Date) {
  return `ai-daily-${formatDateId(date)}`
}

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

  const sourceBlock = [
    "",
    "## 来源链接",
    ...missingSources.map((item) => `- [${item.title}](${item.url}) — ${item.sourceName}`),
  ].join("\n")

  return `${content.trim()}\n${sourceBlock}`
}

export async function generateDailyAiNewsDraft({
  date,
  candidates,
  fetchImpl = fetch,
}: {
  date: Date
  candidates: AiNewsItem[]
  fetchImpl?: typeof fetch
}): Promise<DailyAiNewsDraft> {
  const selectedCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_AI)
  if (selectedCandidates.length === 0) {
    throw new ValidationError("No AI news candidates available")
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    throw new Error("DASHSCOPE_API_KEY is not configured")
  }

  const dateLabel = formatDateId(date)
  const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
  const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
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

  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "你是严谨的中文 AI 新闻主编，输出必须是可解析 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 2400,
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
    content: appendSourceLinks(content, selectedCandidates),
  }
}

export async function runDailyAiNews({
  authorId,
  date = new Date(),
  sources = DAILY_AI_NEWS_SOURCES,
  fetchImpl = fetch,
}: {
  authorId: string
  date?: Date
  sources?: AiNewsSource[]
  fetchImpl?: typeof fetch
}) {
  const slug = buildDailyAiNewsSlug(date)
  const existing = await prisma.post.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true, title: true, slug: true, published: true },
  })

  if (existing) {
    return {
      operation: "skipped" as const,
      reason: "Daily AI news already exists",
      published: existing.published,
      post: existing,
      sourceCount: 0,
      failures: [],
    }
  }

  const { items, failures } = await fetchDailyAiNewsCandidates({ date, sources, fetchImpl })
  const draft = await generateDailyAiNewsDraft({ date, candidates: items, fetchImpl })
  const post = await createAdminPost({
    authorId,
    input: {
      title: draft.title,
      slug: draft.slug,
      content: draft.content,
      excerpt: draft.excerpt,
      published: false,
    },
  })

  let published = false
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
      if (isAutoPublishableReview(review)) {
        await publishAiDraftPost({ postId: post.id })
        published = true
      }

      autoReview = {
        verdict: review.verdict,
        score: review.score,
        summary: review.summary,
        published,
      }
    }
  } catch {
    autoReview = { published: false, error: "Automatic review failed" }
  }

  return {
    operation: "created" as const,
    published,
    post: { ...post, published },
    autoReview,
    sourceCount: items.length,
    failures,
  }
}
