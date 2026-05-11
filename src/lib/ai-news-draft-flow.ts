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
  intro?: unknown
  items?: unknown
  trends?: unknown
}

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

const MAX_CANDIDATES_FOR_AI = readPositiveIntegerEnv("AI_NEWS_MAX_SELECTED_CANDIDATES", 20)
const MAX_DRAFT_TOKENS = readPositiveIntegerEnv("AI_NEWS_MAX_TOKENS", 6000)
const DETAIL_EMOJIS = ["🔊", "🌐", "📝", "🧠", "🛡️", "🤖", "🔧", "🏗️", "📈", "🚀"]

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => readString(item))
    .filter(Boolean)
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

function readStructuredDraftItems(candidate: DraftCandidate, sourceCandidates: AiNewsItem[]) {
  const rawItems = Array.isArray(candidate.items) ? candidate.items : []

  return rawItems
    .map((item, index) => {
      const record = isRecord(item) ? item : {}
      const source = sourceCandidates[index]
      const title = readString(record.title) || source?.title || ""
      const description = readString(record.description) || readString(record.summary) || source?.summary || ""
      const keyPoints = readStringArray(record.keyPoints)
        .concat(readStringArray(record.keyDetails))
        .concat(readStringArray(record.key_points))
      const sourceName = readString(record.sourceName) || readString(record.source) || source?.sourceName || "来源"
      const url = readString(record.url) || source?.url || ""

      return {
        title,
        description,
        keyPoints: keyPoints.length > 0 ? keyPoints.slice(0, 5) : [description].filter(Boolean),
        sourceName,
        url,
      }
    })
    .filter((item) => Boolean(item.title || item.description))
}

function readStructuredDraftTrends(candidate: DraftCandidate) {
  const rawTrends = Array.isArray(candidate.trends) ? candidate.trends : []

  return rawTrends
    .map((trend, index) => {
      if (typeof trend === "string") {
        return { title: `趋势 ${index + 1}`, desc: trend.trim() }
      }

      const record = isRecord(trend) ? trend : {}
      return {
        title: readString(record.title) || `趋势 ${index + 1}`,
        desc: readString(record.desc) || readString(record.description) || readString(record.summary),
      }
    })
    .filter((trend) => Boolean(trend.desc))
    .slice(0, 5)
}

function renderStructuredDraftSource(sourceName: string, url: string) {
  if (!url) {
    return `> 来源：${escapeMarkdownInline(sourceName)}`
  }

  return `> 来源：[${escapeMarkdownInline(sourceName)}](${url})`
}

function renderStructuredDraftContent(candidate: DraftCandidate, sourceCandidates: AiNewsItem[]) {
  const intro = readString(candidate.intro) || readString(candidate.excerpt)
  const items = readStructuredDraftItems(candidate, sourceCandidates)
  const trends = readStructuredDraftTrends(candidate)

  if (!intro && items.length === 0 && trends.length === 0) {
    return ""
  }

  const fallbackIntro = sourceCandidates.length > 0
    ? `今日精选 ${sourceCandidates.length} 条 AI 动态，覆盖模型能力、开发者工具和产品应用等方向。`
    : "今日 AI 动态仍需结合来源继续观察。"
  const renderedItems = items.length > 0
    ? items.map((item, index) => [
        `### ${index + 1}、${escapeMarkdownInline(item.title || `重点新闻 ${index + 1}`)}`,
        "",
        item.description || "详情以来源链接为准。",
        "",
        "【AiBase提要:】",
        "",
        ...item.keyPoints.map((point, pointIndex) => `${DETAIL_EMOJIS[pointIndex % DETAIL_EMOJIS.length]} ${point}`),
        "",
        renderStructuredDraftSource(item.sourceName, item.url),
      ].join("\n"))
    : sourceCandidates.map((item, index) => [
        `### ${index + 1}、${escapeMarkdownInline(item.title)}`,
        "",
        item.summary || "详情以来源链接为准。",
        "",
        "【AiBase提要:】",
        "",
        `${DETAIL_EMOJIS[index % DETAIL_EMOJIS.length]} ${item.summary || item.title}`,
        "",
        renderStructuredDraftSource(item.sourceName, item.url),
      ].join("\n"))
  const renderedTrends = trends.length > 0
    ? trends.map((trend, index) => `${index + 1}. **${escapeMarkdownInline(trend.title)}** — ${trend.desc}`)
    : ["1. **热点分布更分散** — 今日候选新闻仍需结合来源持续观察。"]
  const seenSourceUrls = new Set<string>()
  const sourceLines = sourceCandidates.flatMap((item) => {
    const url = item.url.trim()
    if (!url || seenSourceUrls.has(url)) {
      return []
    }

    seenSourceUrls.add(url)
    return [`- [${escapeMarkdownInline(item.title)}](${url}) — ${escapeMarkdownInline(item.sourceName)}`]
  })

  return [
    "## 今日摘要",
    "",
    intro || fallbackIntro,
    "",
    "## 今日重点",
    "",
    ...renderedItems,
    "",
    "## 今日趋势总结",
    "",
    "综合今日动态，AI 领域呈现以下趋势：",
    ...renderedTrends,
    "",
    "## 来源链接",
    ...(sourceLines.length > 0 ? sourceLines : ["- 暂无来源链接。"]),
  ].join("\n")
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
    "JSON 字段：title, excerpt, intro, items, trends。",
    "items 是数组，每项包含 title, description, keyPoints, sourceName, url。",
    "trends 是数组，每项包含 title, desc。",
    "要求：",
    "1. title 使用“YYYY-MM-DD AI 日报：核心主题”格式，不超过 80 个中文字符。",
    "2. excerpt 为 70-120 个中文字符。",
    "3. intro 为 2-4 句今日摘要，概述当日 AI 领域格局。",
    "4. items 优先选择 8-12 条信息密度高、对开发者或行业有价值的新闻；每条 description 写 1 段中文说明，keyPoints 写 2-4 条提要。",
    "5. trends 总结 3-5 条趋势，title 简短，desc 说明趋势依据。",
    "6. 只使用候选新闻给出的事实，不编造未提供的数据；每条重要新闻保留来源名称和 URL。",
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
      max_tokens: MAX_DRAFT_TOKENS,
      ...getAiModelChatRequestExtras(resolvedModel),
    }),
  })

  const payload = (await response.json()) as DashScopePayload
  if (!response.ok) {
    throw new Error(payload.error?.message || "AI news generation failed")
  }

  const candidate = parseDraftCandidate(extractCompletionText(payload))
  const title = readString(candidate.title)
  const excerpt = readString(candidate.excerpt) || readString(candidate.intro)
  const content = readString(candidate.content) || renderStructuredDraftContent(candidate, selectedCandidates)

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
