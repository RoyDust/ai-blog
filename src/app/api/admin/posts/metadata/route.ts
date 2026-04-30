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

function parseCandidate(text: string): MetadataCandidate {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return typeof parsed === "object" && parsed !== null ? (parsed as MetadataCandidate) : {}
  } catch {
    throw new ValidationError("Metadata generation returned invalid JSON")
  }
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? value.slice(0, maxLength).trim() : value
}

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

export async function POST(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; content?: string }
    const content = body.content?.trim()

    if (!content) {
      throw new ValidationError("Article content is required")
    }

    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "DASHSCOPE_API_KEY is not configured" }, { status: 500 })
    }

    const [categories, tags] = await Promise.all([getCategoryDirectory(), getTagDirectory()])
    const categorySlugs: Set<string> = new Set(categories.map((category: { slug: string }) => category.slug))
    const tagSlugs: Set<string> = new Set(tags.map((tag: { slug: string }) => tag.slug))
    const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
    const prompt = [
      "请根据文章内容补全博客后台元信息。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：title, slug, excerpt, categorySlug, tagSlugs。",
      `title 不超过 ${AI_AUTHORING_LIMITS.titleMaxLength} 字；excerpt 控制在 70 到 120 个中文字符内，最多 ${AI_AUTHORING_LIMITS.excerptMaxLength} 字。`,
      "slug 使用英文小写、数字和连字符；categorySlug 必须从可选分类中选择一个；tagSlugs 最多选择 5 个且必须来自可选标签。",
      `可选分类：${categories.map((category: { name: string; slug: string }) => `${category.name}(${category.slug})`).join(", ") || "无"}`,
      `可选标签：${tags.map((tag: { name: string; slug: string }) => `${tag.name}(${tag.slug})`).join(", ") || "无"}`,
      body.title?.trim() ? `当前标题：${body.title.trim()}` : undefined,
      `文章内容：\n${content.slice(0, 12_000)}`,
    ]
      .filter(Boolean)
      .join("\n\n")

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
        max_tokens: 500,
      }),
    })

    const payload = (await response.json()) as DashScopePayload

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message || "Metadata generation failed" }, { status: 502 })
    }

    const candidate = parseCandidate(extractCompletionText(payload))
    const title = truncate(readOptionalString(candidate.title) || body.title?.trim() || "未命名文章", AI_AUTHORING_LIMITS.titleMaxLength)
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
