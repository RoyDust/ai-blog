import { getAiModelChatRequestExtras, getAiModelForCapability, type AiModelOption } from "@/lib/ai-models"
import { buildDailyAiNewsSlug, formatDateId, type AiNewsItem } from "@/lib/ai-news-parser"
import { ValidationError } from "@/lib/api-errors"

export type DailyAiNewsDraft = {
  title: string
  slug: string
  excerpt: string
  content: string
  generatedBy: AiNewsGeneratorModel
}

export type AiNewsGeneratorModel = {
  id: string
  name: string
  model: string
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

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

const MAX_CANDIDATES_FOR_AI = readPositiveIntegerEnv("AI_NEWS_MAX_SELECTED_CANDIDATES", 20)

/**
 * Normalizes OpenAI-compatible completion output into plain text.
 */
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

/**
 * Accepts strict JSON, fenced JSON, or text with a JSON object embedded inside.
 */
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

/**
 * Parses the model's draft object and raises a validation error for malformed JSON.
 */
function parseDraftCandidate(text: string): DraftCandidate {
  try {
    const parsed = JSON.parse(stripJsonFence(text))
    return typeof parsed === "object" && parsed !== null ? (parsed as DraftCandidate) : {}
  } catch {
    throw new ValidationError("AI news generation returned invalid JSON")
  }
}

/**
 * Compresses selected news items into the factual digest sent to the model.
 */
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

/**
 * Ensures generated Markdown still carries direct source URLs for traceability.
 */
function appendSourceLinks(content: string, candidates: AiNewsItem[]) {
  const missingSources = candidates.filter((item) => !content.includes(item.url)).slice(0, MAX_CANDIDATES_FOR_AI)
  if (missingSources.length === 0) return content

  const sourceLinks = missingSources.map((item) => `- [${item.title}](${item.url}) — ${item.sourceName}`)
  if (/^#{1,6}\s+来源链接\s*$/im.test(content)) {
    return `${content.trim()}\n${sourceLinks.join("\n")}`
  }

  const sourceBlock = [
    "",
    "## 来源链接",
    ...sourceLinks,
  ].join("\n")

  return `${content.trim()}\n${sourceBlock}`
}

function escapeMarkdownInline(value: string) {
  return value.replace(/([\\`*_\[\]])/g, "\\$1")
}

function getGeneratorModelSnapshot(aiModel: AiModelOption): AiNewsGeneratorModel {
  return {
    id: aiModel.id,
    name: aiModel.name,
    model: aiModel.model,
  }
}

/**
 * Resolves the model used for daily AI news and verifies that it has an API key.
 */
export async function resolveDailyAiNewsModel(modelId?: string | null) {
  const aiModel = await getAiModelForCapability("post-summary", modelId)

  if (!aiModel) {
    throw new ValidationError("AI model is not available for daily AI news")
  }

  if (!aiModel.apiKey) {
    throw new Error(`${aiModel.apiKeyEnv} is not configured`)
  }

  return aiModel
}

function appendGeneratorAttribution(content: string, aiModel: AiModelOption) {
  const modelName = escapeMarkdownInline(aiModel.name)
  const model = escapeMarkdownInline(aiModel.model)
  const attribution = [
    "",
    "---",
    "",
    `> 生成标注：本文由 AI 模型 **${modelName}**（${model}）生成，基于上方公开来源整理。`,
  ].join("\n")

  return `${content.trim()}\n${attribution}`
}

/**
 * 调用选定模型生成中文 AI 日报草稿。
 *
 * 输入要求：
 * - candidates 必须先经过候选筛选，否则会放大模型噪声
 * - modelId 可选；不传时会回退到 post-summary 能力对应的默认模型
 *
 * 输出结果：
 * - 标题、slug、摘要、Markdown 正文
 * - generatedBy 快照，便于后续追踪是哪个模型生成的内容
 */
export async function generateDailyAiNewsDraft({
  date,
  candidates,
  aiModel,
  modelId,
  fetchImpl = fetch,
}: {
  date: Date
  candidates: AiNewsItem[]
  aiModel?: AiModelOption
  modelId?: string | null
  fetchImpl?: typeof fetch
}): Promise<DailyAiNewsDraft> {
  const selectedCandidates = candidates.slice(0, MAX_CANDIDATES_FOR_AI)
  if (selectedCandidates.length === 0) {
    throw new ValidationError("No AI news candidates available")
  }

  const resolvedModel = aiModel ?? (await resolveDailyAiNewsModel(modelId))

  const dateLabel = formatDateId(date)
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

  const response = await fetchImpl(`${resolvedModel.baseUrl}${resolvedModel.requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resolvedModel.apiKey}`,
    },
    body: JSON.stringify({
      model: resolvedModel.model,
      messages: [
        { role: "system", content: "你是严谨的中文 AI 新闻主编，输出必须是可解析 JSON。" },
        { role: "user", content: prompt },
      ],
      temperature: 0.25,
      max_tokens: 2400,
      ...getAiModelChatRequestExtras(resolvedModel),
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
    content: appendGeneratorAttribution(appendSourceLinks(content, selectedCandidates), resolvedModel),
    generatedBy: getGeneratorModelSnapshot(resolvedModel),
  }
}
