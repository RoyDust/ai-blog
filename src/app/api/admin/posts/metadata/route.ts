import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"
import { AI_AUTHORING_LIMITS } from "@/lib/ai-contract"
import { generatePostSlug } from "@/lib/slug"
import { getCategoryDirectory, getTagDirectory } from "@/lib/taxonomy"

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

type MetadataCandidate = {
  title?: unknown
  slug?: unknown
  excerpt?: unknown
  categorySlug?: unknown
  tagSlugs?: unknown
}

type MetadataField = "all" | "title" | "slug" | "category" | "tags"

const metadataFields = new Set<MetadataField>(["all", "title", "slug", "category", "tags"])

type TaxonomyItem = {
  name: string
  slug: string
}

/**
 * 从 DashScope 兼容接口响应中提取文本内容。
 */
function extractCompletionText(payload: DashScopePayload) {
  const content = payload.choices?.[0]?.message?.content

  if (typeof content === "string") {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim()
  }

  return ""
}

/**
 * 去掉模型可能包裹在 JSON 外层的 Markdown fence 或解释文本。
 */
function stripJsonFence(value: string) {
  const trimmed = value.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)

  if (fenced?.[1]) {
    return fenced[1].trim()
  }

  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")

  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1)
  }

  return trimmed
}

/**
 * 解析 AI 返回的元数据候选 JSON。
 */
function parseCandidate(text: string): MetadataCandidate {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return typeof parsed === "object" && parsed !== null ? (parsed as MetadataCandidate) : {}
  } catch {
    throw new ValidationError("Metadata generation returned invalid JSON")
  }
}

/**
 * 安全读取可选字符串字段。
 */
function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * 截断 AI 返回字段，避免超过文章字段长度约束。
 */
function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value
}

/**
 * 只保留当前系统已有标签 slug，并去重。
 */
function normalizeTagSlugs(value: unknown, allowedSlugs: Set<string>) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: string[] = []

  for (const item of value) {
    if (typeof item !== "string") continue

    const slug = item.trim()
    if (!slug || !allowedSlugs.has(slug) || seen.has(slug)) continue

    seen.add(slug)
    normalized.push(slug)
  }

  return normalized
}

/**
 * 解析前端请求的单字段生成模式。
 */
function normalizeMetadataField(value: unknown): MetadataField {
  return typeof value === "string" && metadataFields.has(value as MetadataField) ? (value as MetadataField) : "all"
}

/**
 * 把可选分类/标签目录格式化进提示词。
 */
function formatTaxonomyOptions(items: TaxonomyItem[]) {
  return items.map((item) => `${item.name}(${item.slug})`).join(", ") || "无"
}

/**
 * 按字段类型限制发送给模型的正文长度。
 */
function getContentLimit(field: MetadataField) {
  if (field === "slug") return 4_000
  if (field === "title" || field === "category" || field === "tags") return 8_000
  return 12_000
}

/**
 * 按字段类型限制模型输出 token。
 */
function getMaxTokens(field: MetadataField) {
  if (field === "slug" || field === "category") return 80
  if (field === "title") return 120
  if (field === "tags") return 160
  return 500
}

/**
 * 构造元数据补全提示词。
 *
 * 单字段模式只要求返回目标字段，降低模型输出偏移和 JSON 解析失败概率。
 */
function buildPrompt({
  categories,
  content,
  field,
  tags,
  title,
}: {
  categories: TaxonomyItem[]
  content: string
  field: MetadataField
  tags: TaxonomyItem[]
  title: string
}) {
  const contentBlock = content ? `文章内容：\n${content.slice(0, getContentLimit(field))}` : undefined
  const currentTitle = title ? `当前标题：${title}` : undefined

  if (field === "title") {
    return [
      "请根据文章内容生成一个中文博客标题。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：title。",
      `title 不超过 ${AI_AUTHORING_LIMITS.titleMaxLength} 字。`,
      currentTitle,
      contentBlock,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  if (field === "slug") {
    return [
      "请根据文章标题和内容生成一个 URL 友好的 slug。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：slug。",
      "slug 使用英文小写、数字和连字符，不要中文、空格或下划线。",
      currentTitle,
      contentBlock,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  if (field === "category") {
    return [
      "请根据文章内容从可选分类中选择一个最合适的分类。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：categorySlug。",
      "categorySlug 必须来自可选分类。",
      `可选分类：${formatTaxonomyOptions(categories)}`,
      currentTitle,
      contentBlock,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  if (field === "tags") {
    return [
      "请根据文章内容从可选标签中选择最合适的标签。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：tagSlugs。",
      "tagSlugs 最多选择 5 个且必须来自可选标签。",
      `可选标签：${formatTaxonomyOptions(tags)}`,
      currentTitle,
      contentBlock,
    ]
      .filter(Boolean)
      .join("\n\n")
  }

  return [
    "请根据文章内容补全博客后台元信息。",
    "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
    "JSON 字段：title, slug, excerpt, categorySlug, tagSlugs。",
    `title 不超过 ${AI_AUTHORING_LIMITS.titleMaxLength} 字；excerpt 控制在 70 到 120 个中文字符内，最多 ${AI_AUTHORING_LIMITS.excerptMaxLength} 字。`,
    "slug 使用英文小写、数字和连字符；categorySlug 必须从可选分类中选择一个；tagSlugs 最多选择 5 个且必须来自可选标签。",
    `可选分类：${formatTaxonomyOptions(categories)}`,
    `可选标签：${formatTaxonomyOptions(tags)}`,
    currentTitle,
    contentBlock,
  ]
    .filter(Boolean)
    .join("\n\n")
}

/**
 * 旧版文章元数据补全入口。
 *
 * 该接口直接调用 DashScope 兼容接口，返回可回填到编辑器的标题、slug、分类和标签建议。
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; content?: string; field?: unknown }
    const field = normalizeMetadataField(body.field)
    const titleInput = body.title?.trim() ?? ""
    const content = body.content?.trim()

    if (!content && !(field === "slug" && titleInput)) {
      throw new ValidationError("Article content is required")
    }

    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "DASHSCOPE_API_KEY is not configured" }, { status: 500 })
    }

    const [categories, tags] = await Promise.all([
      field === "all" || field === "category" ? getCategoryDirectory() : Promise.resolve([]),
      field === "all" || field === "tags" ? getTagDirectory() : Promise.resolve([]),
    ])
    const categorySlugs: Set<string> = new Set(categories.map((category: { slug: string }) => category.slug))
    const tagSlugs: Set<string> = new Set(tags.map((tag: { slug: string }) => tag.slug))
    const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
    const prompt = buildPrompt({ categories, content: content ?? "", field, tags, title: titleInput })

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是一个严谨的中文博客编辑，只返回可解析 JSON。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: getMaxTokens(field),
      }),
    })

    const payload = (await response.json()) as DashScopePayload

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message || "Metadata generation failed" }, { status: 502 })
    }

    const candidate = parseCandidate(extractCompletionText(payload))

    if (field === "title") {
      const title = truncate(readOptionalString(candidate.title) || titleInput, AI_AUTHORING_LIMITS.titleMaxLength)
      if (!title) {
        return NextResponse.json({ error: "Metadata generation failed" }, { status: 502 })
      }

      return NextResponse.json({ success: true, data: { title } })
    }

    if (field === "slug") {
      const slugSource = readOptionalString(candidate.slug) || titleInput || "post"
      return NextResponse.json({ success: true, data: { slug: generatePostSlug(slugSource) } })
    }

    if (field === "category") {
      const categorySlug = readOptionalString(candidate.categorySlug)
      return NextResponse.json({
        success: true,
        data: { categorySlug: categorySlug && categorySlugs.has(categorySlug) ? categorySlug : null },
      })
    }

    if (field === "tags") {
      return NextResponse.json({ success: true, data: { tagSlugs: normalizeTagSlugs(candidate.tagSlugs, tagSlugs) } })
    }

    const title = truncate(readOptionalString(candidate.title) || titleInput || "未命名文章", AI_AUTHORING_LIMITS.titleMaxLength)
    const slugSource = readOptionalString(candidate.slug) || title
    const categorySlug = readOptionalString(candidate.categorySlug)
    const excerpt = truncate(readOptionalString(candidate.excerpt), AI_AUTHORING_LIMITS.excerptMaxLength)

    if (!excerpt) {
      return NextResponse.json({ error: "Metadata generation failed" }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      data: {
        title,
        slug: generatePostSlug(slugSource),
        excerpt,
        categorySlug: categorySlug && categorySlugs.has(categorySlug) ? categorySlug : null,
        tagSlugs: normalizeTagSlugs(candidate.tagSlugs, tagSlugs),
      },
    })
  } catch (error) {
    return toErrorResponse(error, "Metadata generation failed")
  }
}
