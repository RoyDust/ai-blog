import { ValidationError } from "@/lib/api-errors"

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

export type ReviewCheckStatus = "pass" | "warn" | "fail"
export type ReviewVerdict = "ready" | "needs-work"

export type PostReviewReport = {
  verdict: ReviewVerdict
  score: number
  summary: string
  checks: Array<{ label: string; status: ReviewCheckStatus; detail: string }>
  suggestions: string[]
}

type ReviewCandidate = {
  verdict?: unknown
  score?: unknown
  summary?: unknown
  checks?: unknown
  suggestions?: unknown
}

export type PostReviewInput = {
  title: string
  slug: string
  content: string
  coverImage?: string | null
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

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === "\\") {
      escaped = inString
      continue
    }

    if (char === "\"") {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === "{") {
      depth += 1
    } else if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

function parseCandidate(text: string): ReviewCandidate {
  const candidates = [
    stripJsonFence(text),
    extractFirstJsonObject(text),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      return typeof parsed === "object" && parsed !== null ? (parsed as ReviewCandidate) : {}
    } catch {
      // Try the next extraction strategy before reporting a structured review error.
    }
  }

  try {
    const parsed = JSON.parse(text)
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

export function isAutoPublishableReview(review: PostReviewReport | null | undefined) {
  if (!review) {
    return false
  }

  return review.verdict === "ready" && review.score >= 85 && review.checks.every((check) => check.status !== "fail")
}

export async function generatePostReview(
  input: PostReviewInput,
  options: { requireConfigured?: boolean } = {},
): Promise<PostReviewReport | null> {
  const title = input.title.trim()
  const slug = input.slug.trim()
  const content = input.content.trim()

  if (!title || !slug || !content) {
    throw new ValidationError("Title, slug and content are required")
  }

  const apiKey = process.env.DASHSCOPE_API_KEY
  if (!apiKey) {
    if (options.requireConfigured) {
      throw new Error("DASHSCOPE_API_KEY is not configured")
    }

    return null
  }

  const baseUrl = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1"
  const model = process.env.DASHSCOPE_MODEL ?? "qwen3.5-flash"
  const reviewDate = new Date().toISOString().slice(0, 10)
  const prompt = [
    "请对这篇准备发布的博客文章做发布前审稿。",
    "只输出一个 JSON 对象，不要 Markdown、注释或额外说明。",
    "JSON 字段：verdict, score, summary, checks, suggestions。",
    "verdict 只能是 ready 或 needs-work；score 为 0-100；checks 数组元素包含 label、status、detail，其中 status 只能是 pass、warn、fail；suggestions 是字符串数组。",
    "重点检查：标题清晰度、结构完整度、摘要/导读价值、事实风险、可读性、SEO、是否适合发布。",
    `审稿基准日期：${reviewDate}。如果文章日期等于或早于该日期，不要仅因年份或日期本身判定为未来内容；只有来源事实与文章日期明显冲突时才标记时间线风险。`,
    `标题：${title}`,
    `Slug：${slug}`,
    `封面：${input.coverImage?.trim() ? "已设置" : "未设置"}`,
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
      max_tokens: 1400,
    }),
  })

  const payload = (await response.json()) as DashScopePayload

  if (!response.ok) {
    throw new Error(payload.error?.message || "Review generation failed")
  }

  const candidate = parseCandidate(extractCompletionText(payload))
  const score = clampScore(candidate.score)
  const summary = readString(candidate.summary)

  if (!summary) {
    throw new Error("Review generation failed")
  }

  return {
    verdict: normalizeVerdict(candidate.verdict, score),
    score,
    summary,
    checks: normalizeChecks(candidate.checks),
    suggestions: normalizeSuggestions(candidate.suggestions),
  }
}
