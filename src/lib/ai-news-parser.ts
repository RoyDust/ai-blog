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

const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id", "fbclid", "gclid"])

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

/**
 * Removes tracking noise so feeds that link to the same article dedupe correctly.
 */
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

/**
 * Formats dates for stable daily-news identifiers.
 */
export function formatDateId(date: Date) {
  return date.toISOString().slice(0, 10)
}

/**
 * 根据日期生成日报文章 slug。
 * 该 slug 稳定且可预测，便于幂等更新同一天的日报文章。
 */
export function buildDailyAiNewsSlug(date: Date) {
  return `ai-daily-${formatDateId(date)}`
}

/**
 * 解析单个 RSS / Atom feed，并统一映射为内部 AiNewsItem。
 * 这里只做格式解析与字段清洗，不负责跨源去重和业务筛选。
 */
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

/**
 * 基于 canonical URL 对新闻项做轻量去重。
 * 这是抓取阶段的第一层去重，后续还会有更重的语义去重流程。
 */
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
