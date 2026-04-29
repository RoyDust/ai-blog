import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { clampPagination } from "@/lib/validation"

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

type SearchPostCandidate = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  content?: string | null
  category?: { name?: string | null; slug?: string | null } | null
  tags?: Array<{ name?: string | null; slug?: string | null }>
}

function contains(source: string | null | undefined, query: string) {
  return source?.toLowerCase().includes(query) ?? false
}

function getSearchMeta(
  post: {
    title?: string | null
    excerpt?: string | null
    content?: string | null
    author?: { name?: string | null } | null
    category?: { name?: string | null } | null
    tags?: Array<{ name?: string | null }>
  },
  query: string,
) {
  const hitFields: string[] = []
  let score = 0

  if (contains(post.title, query)) {
    hitFields.push('title')
    score += 12
  }
  if (contains(post.excerpt, query)) {
    hitFields.push('excerpt')
    score += 8
  }
  if (contains(post.content, query)) {
    hitFields.push('content')
    score += 4
  }
  if (contains(post.author?.name, query)) {
    hitFields.push('author')
    score += 3
  }
  if (contains(post.category?.name, query)) {
    hitFields.push('category')
    score += 2
  }
  if (post.tags?.some((tag) => contains(tag.name, query))) {
    hitFields.push('tags')
    score += 2
  }

  return { score, hitFields }
}

function extractCompletionText(payload: DashScopePayload) {
  const content = payload.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join('\n')
      .trim()
  }

  return ''
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

function parseAiSearchPayload(text: string) {
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
  const apiKey = process.env.DASHSCOPE_API_KEY

  if (!apiKey || items.length === 0) {
    return null
  }

  const baseUrl = process.env.DASHSCOPE_BASE_URL ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  const model = process.env.DASHSCOPE_MODEL ?? 'qwen3.5-flash'
  const candidates = items.slice(0, 8).map((item, index) => ({
    index: index + 1,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    snippet: item.content?.slice(0, 220),
    category: item.category?.name,
    tags: item.tags?.map((tag) => tag.name).filter(Boolean),
  }))
  const prompt = [
    '请根据用户查询和候选文章生成站内搜索摘要，并在候选范围内给出推荐顺序。',
    '只输出一个 JSON 对象，不要 Markdown、注释或额外说明。',
    'JSON 字段：summary, rankedSlugs。summary 用一到两句话说明最相关内容；rankedSlugs 是按推荐顺序排列的候选 slug 数组，只能使用候选中的 slug。',
    `用户查询：${query}`,
    `候选文章：${JSON.stringify(candidates)}`,
  ].join('\n\n')

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是站内搜索助手，输出必须是可解析 JSON。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 420,
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as DashScopePayload
  const parsed = parseAiSearchPayload(extractCompletionText(payload))

  if (!parsed.summary) {
    return null
  }

  return parsed
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() ?? ''
    const normalizedQuery = query.toLowerCase()
    const aiRequested = searchParams.get('ai') === '1'

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const { page, limit } = clampPagination({
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    })

    const where: NonNullable<Parameters<typeof prisma.post.findMany>[0]>['where'] = {
      published: true,
      deletedAt: null,
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { excerpt: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
        { author: { name: { contains: query, mode: 'insensitive' } } },
        { category: { name: { contains: query, mode: 'insensitive' } } },
        { tags: { some: { name: { contains: query, mode: 'insensitive' } } } },
      ],
    }

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
          category: true,
          tags: { where: { deletedAt: null } },
          _count: { select: { comments: { where: { deletedAt: null } }, likes: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.post.count({ where }),
    ])

    let rankedItems = items
      .map((item: (typeof items)[number]) => ({
        ...item,
        searchMeta: getSearchMeta(item, normalizedQuery),
      }))
      .sort((left: ((typeof items)[number] & { searchMeta: ReturnType<typeof getSearchMeta> }), right: ((typeof items)[number] & { searchMeta: ReturnType<typeof getSearchMeta> })) => {
        if (right.searchMeta.score !== left.searchMeta.score) {
          return right.searchMeta.score - left.searchMeta.score
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })

    const ai = aiRequested ? await generateAiSearchResult({ query, items: rankedItems }) : null

    if (ai?.rankedSlugs.length) {
      rankedItems = reorderByAiSlugs(rankedItems, ai.rankedSlugs)
    }

    return NextResponse.json({
      success: true,
      data: rankedItems,
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
    console.error('Search posts error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
