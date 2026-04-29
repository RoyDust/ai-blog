import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { toErrorResponse, ValidationError } from "@/lib/api-errors"

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

type ReviewCheckStatus = "pass" | "warn" | "fail"
type ReviewVerdict = "ready" | "needs-work"

type ReviewCandidate = {
  verdict?: unknown
  score?: unknown
  summary?: unknown
  checks?: unknown
  suggestions?: unknown
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

function parseCandidate(text: string): ReviewCandidate {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return typeof parsed === "object" && parsed !== null ? (parsed as ReviewCandidate) : {}
  } catch {
    throw new ValidationError("Review generation returned invalid JSON")
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function clampScore(value: unknown) {
  const score = typeof value === "number" ? value : Number(value)

  if (!Number.isFinite(score)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function normalizeVerdict(value: unknown, score: number): ReviewVerdict {
  return value === "ready" || (value !== "needs-work" && score >= 85) ? "ready" : "needs-work"
}

function normalizeStatus(value: unknown): ReviewCheckStatus {
  return value === "pass" || value === "fail" || value === "warn" ? value : "warn"
}

function normalizeChecks(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => {
      if (typeof item !== "object" || item === null) return null
      const record = item as { label?: unknown; status?: unknown; detail?: unknown }
      const label = readString(record.label)
      const detail = readString(record.detail)

      if (!label || !detail) return null

      return {
        label,
        status: normalizeStatus(record.status),
        detail,
      }
    })
    .filter((item): item is { label: string; status: ReviewCheckStatus; detail: string } => Boolean(item))
    .slice(0, 8)
}

function normalizeSuggestions(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(readString)
    .filter(Boolean)
    .slice(0, 6)
}

export async function POST(request: Request) {
  try {
    await requireAdminSession()

    const body = (await request.json()) as { title?: string; slug?: string; content?: string; coverImage?: string }
    const title = body.title?.trim()
    const slug = body.slug?.trim()
    const content = body.content?.trim()

    if (!title || !slug || !content) {
      throw new ValidationError("Title, slug and content are required")
    }

    const apiKey = process.env.DASHSCOPE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "DASHSCOPE_API_KEY is not configured" }, { status: 500 })
    }

    const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
    const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
    const prompt = [
      "请对这篇准备发布的博客文章做发布前审稿。",
      "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
      "JSON 字段：verdict, score, summary, checks, suggestions。",
      "verdict 只能是 ready 或 needs-work；score 为 0-100；checks 数组元素包含 label、status、detail，其中 status 只能是 pass、warn、fail；suggestions 是字符串数组。",
      "重点检查：标题清晰度、结构完整度、摘要/导读价值、事实风险、可读性、SEO、是否适合发布。",
      `标题：${title}`,
      `Slug：${slug}`,
      `封面：${body.coverImage?.trim() ? "已设置" : "未设置"}`,
      `文章内容：\n${content.slice(0, 14_000)}`,
    ].join("\n\n")

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "你是严谨的中文博客主编，输出必须是可解析 JSON。" },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 700,
      }),
    })

    const payload = (await response.json()) as DashScopePayload

    if (!response.ok) {
      return NextResponse.json({ error: payload.error?.message || "Review generation failed" }, { status: 502 })
    }

    const candidate = parseCandidate(extractCompletionText(payload))
    const score = clampScore(candidate.score)
    const summary = readString(candidate.summary)

    if (!summary) {
      return NextResponse.json({ error: "Review generation failed" }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      data: {
        verdict: normalizeVerdict(candidate.verdict, score),
        score,
        summary,
        checks: normalizeChecks(candidate.checks),
        suggestions: normalizeSuggestions(candidate.suggestions),
      },
    })
  } catch (error) {
    return toErrorResponse(error, "Review generation failed")
  }
}
