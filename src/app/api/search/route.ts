import { withApiOperationLogging } from "@/lib/api-operation-log-route";
/**
 * 前台搜索 API。
 *
 * 职责：
 * - 对已发布文章做全文 / 分类 / 标签 / 作者维度的站内检索
 * - 委托搜索域模块完成全局相关性排序、统计与分页
 * - 在用户显式请求时调用 AI 生成搜索摘要与推荐顺序
 * - 处理搜索与 AI 搜索的独立限流
 */
import { NextResponse } from "next/server"
import { toErrorResponse, TooManyRequestsError, ValidationError } from "@/lib/api-errors"
import { checkAiSearchRateLimit, checkSearchRateLimit } from "@/lib/rate-limit"
import { searchPublicPosts, type PublicSearchPost } from "@/lib/public-search"
import { getAiModelForCapability } from "@/lib/ai-models"
import { createCompletionClientForModel } from "@/lib/ai-completion-client"
import { clampPagination } from "@/lib/validation"

const SEARCH_MIN_QUERY_LENGTH = 2
const SEARCH_MAX_QUERY_LENGTH = 200
const AI_SEARCH_CACHE_TTL_MS = 5 * 60_000
const MAX_AI_SEARCH_CACHE_ENTRIES = 500
const AI_SEARCH_SNIPPET_MAX_LENGTH = 220

type SearchPostCandidate = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  contentSnippet?: string | null
  category?: { name?: string | null; slug?: string | null } | null
  tags?: Array<{ name?: string | null; slug?: string | null }>
}

type AiSearchResult = {
  summary: string
  rankedSlugs: string[]
}

const aiSearchCache = new Map<string, { expiresAt: number; value: AiSearchResult }>()

function countQueryCharacters(query: string) {
  return Array.from(query).length
}

function stripJsonFence(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

function parseAiSearchPayload(text: string): AiSearchResult {
  try {
    const parsed = JSON.parse(stripJsonFence(text)) as { summary?: unknown; rankedSlugs?: unknown }
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : ''
    const rankedSlugs = Array.isArray(parsed.rankedSlugs)
      ? parsed.rankedSlugs.filter((slug): slug is string => typeof slug === 'string' && slug.trim().length > 0)
      : []

    return { summary, rankedSlugs }
  } catch {
    return { summary: '', rankedSlugs: [] }
  }
}

function buildAiSearchCacheKey(query: string, items: SearchPostCandidate[]) {
  const candidateSignature = items
    .slice(0, 8)
    .map((item) => item.slug)
    .join(',')

  return `${query.toLowerCase()}::${candidateSignature}`
}

function sweepExpiredAiSearchCacheFromHead(now: number) {
  for (const [key, entry] of aiSearchCache) {
    if (entry.expiresAt > now) {
      break
    }
    aiSearchCache.delete(key)
  }
}

function sweepAllExpiredAiSearchCache(now: number) {
  for (const [key, entry] of aiSearchCache) {
    if (entry.expiresAt <= now) {
      aiSearchCache.delete(key)
    }
  }
}

function readAiSearchCache(cacheKey: string) {
  const now = Date.now()
  sweepExpiredAiSearchCacheFromHead(now)

  const cached = aiSearchCache.get(cacheKey)

  if (!cached) {
    return null
  }

  if (cached.expiresAt <= now) {
    aiSearchCache.delete(cacheKey)
    return null
  }

  aiSearchCache.delete(cacheKey)
  aiSearchCache.set(cacheKey, cached)

  return cached.value
}

function writeAiSearchCache(cacheKey: string, value: AiSearchResult) {
  const now = Date.now()
  sweepExpiredAiSearchCacheFromHead(now)

  if (aiSearchCache.has(cacheKey)) {
    aiSearchCache.delete(cacheKey)
  }

  if (aiSearchCache.size >= MAX_AI_SEARCH_CACHE_ENTRIES) {
    sweepAllExpiredAiSearchCache(now)

    while (aiSearchCache.size >= MAX_AI_SEARCH_CACHE_ENTRIES) {
      const oldestKey = aiSearchCache.keys().next().value
      if (oldestKey === undefined) {
        break
      }
      aiSearchCache.delete(oldestKey)
    }
  }

  aiSearchCache.set(cacheKey, {
    expiresAt: now + AI_SEARCH_CACHE_TTL_MS,
    value,
  })
}

function reorderByAiSlugs<T extends { slug: string }>(items: T[], rankedSlugs: string[]) {
  if (rankedSlugs.length === 0) {
    return items
  }

  const rank = new Map(rankedSlugs.map((slug, index) => [slug, index]))

  return [...items].sort((left, right) => {
    const leftRank = rank.get(left.slug) ?? Number.POSITIVE_INFINITY
    const rightRank = rank.get(right.slug) ?? Number.POSITIVE_INFINITY

    return leftRank - rightRank
  })
}

async function generateAiSearchResult({ query, items }: { query: string; items: SearchPostCandidate[] }) {
  const aiModel = await getAiModelForCapability("post-summary")
  const apiKey = aiModel?.apiKey

  if (!apiKey || items.length === 0) {
    return null
  }

  const candidates = items.slice(0, 8).map((item, index) => {
    const excerpt = item.excerpt?.trim() || null
    const contentSnippet = item.contentSnippet?.slice(0, AI_SEARCH_SNIPPET_MAX_LENGTH).trim() || null

    return {
      index: index + 1,
      slug: item.slug,
      title: item.title,
      excerpt,
      snippet: (contentSnippet || excerpt) ?? undefined,
      category: item.category?.name,
      tags: item.tags?.map((tag) => tag.name).filter(Boolean),
    }
  })
  const prompt = [
    '请根据用户查询和候选文章生成站内搜索摘要，并在候选范围内给出推荐顺序。',
    '只输出一个 JSON 对象，不要 Markdown、注释或额外说明。',
    'JSON 字段：summary, rankedSlugs。summary 用一到两句话说明最相关内容；rankedSlugs 是按推荐顺序排列的候选 slug 数组，只能使用候选中的 slug。',
    `用户查询：${query}`,
    `候选文章：${JSON.stringify(candidates)}`,
  ].join('\n\n')

  try {
    const client = createCompletionClientForModel(aiModel, undefined, "ai.search")
    const result = await client.completeText([
      { role: "system", content: "你是站内搜索助手，输出必须是可解析 JSON。" },
      { role: "user", content: prompt },
    ], {
      strategy: "interactive-completion",
      bodyExtensions: { temperature: 0.2, max_tokens: 420 },
    })
    const parsed = parseAiSearchPayload(result.text)

    if (!parsed.summary) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * 处理搜索请求。
 *
 * 查询参数：
 * - q: 搜索词
 * - page / limit: 分页
 * - ai=1: 显式请求 AI 搜索增强
 */
async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() ?? ''
    const aiRequested = searchParams.get('ai') === '1'

    if (!query) {
      throw new ValidationError('Query is required')
    }

    if (countQueryCharacters(query) < SEARCH_MIN_QUERY_LENGTH) {
      throw new ValidationError(`Query must be at least ${SEARCH_MIN_QUERY_LENGTH} characters`)
    }

    if (countQueryCharacters(query) > SEARCH_MAX_QUERY_LENGTH) {
      throw new ValidationError(`Query must be at most ${SEARCH_MAX_QUERY_LENGTH} characters`)
    }

    const searchRateLimit = await checkSearchRateLimit(request)
    if (!searchRateLimit.allowed) {
      throw new TooManyRequestsError()
    }

    const { page, limit } = clampPagination({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })

    const { items: searchItems, total } = await searchPublicPosts({
      query,
      page,
      limit,
    })

    let rankedItems = searchItems

    let ai: AiSearchResult | null = null

    if (aiRequested) {
      const aiCacheKey = buildAiSearchCacheKey(query, rankedItems)
      ai = readAiSearchCache(aiCacheKey)

      if (!ai) {
        const aiRateLimit = await checkAiSearchRateLimit(request)
        if (!aiRateLimit.allowed) {
          throw new TooManyRequestsError('Too many AI search requests')
        }

        ai = await generateAiSearchResult({ query, items: rankedItems })
        if (ai) {
          writeAiSearchCache(aiCacheKey, ai)
        }
      }
    }

    if (ai?.rankedSlugs.length) {
      rankedItems = reorderByAiSlugs(rankedItems, ai.rankedSlugs)
    }

    const publicItems = rankedItems.map((item: PublicSearchPost) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt ?? null,
      coverImage: item.coverImage ?? null,
      ...(item.featured !== undefined ? { featured: item.featured } : {}),
      createdAt: item.createdAt,
      ...(item.readingTimeMinutes !== undefined ? { readingTimeMinutes: item.readingTimeMinutes } : {}),
      ...(item.viewCount !== undefined ? { viewCount: item.viewCount } : {}),
      author: item.author
        ? {
            id: item.author.id,
            name: item.author.name ?? null,
            image: item.author.image ?? null,
          }
        : null,
      category: item.category
        ? {
            name: item.category.name ?? null,
            slug: item.category.slug ?? null,
          }
        : null,
      tags: Array.isArray(item.tags)
        ? item.tags.map((tag) => ({
            name: tag.name ?? null,
            slug: tag.slug ?? null,
          }))
        : [],
      _count: {
        comments: item._count?.comments ?? 0,
        likes: item._count?.likes ?? 0,
      },
      searchMeta: item.searchMeta,
    }))

    return NextResponse.json({
      success: true,
      data: publicItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        query,
      },
      ai: ai ? { summary: ai.summary } : undefined,
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.search.read', route: '/api/search' });
