/**
 * AI 日报日级主编稿生成模块。
 *
 * 职责：
 * - 基于已校验的候选与事实卡生成更完整的日报正文结构
 * - 对模型输出做最低质量校验，避免短句和重复提要进入最终渲染
 * - 失败时返回 null，让编排层继续使用确定性 FactCard 渲染兜底
 */
import { getAiModelChatRequestExtras, type AiModelOption } from "@/lib/ai-models"
import type { AiNewsFactCard, AiNewsScoredCandidate } from "@/lib/ai-news-types"

export type DailyAiNewsEditorialItem = {
  sourceTitle: string
  editorialTitle: string
  description: string
  keyPoints: string[]
  impact?: string
  sourceName: string
  url: string
}

export type DailyAiNewsEditorialTrend = {
  title: string
  desc: string
  evidenceTitles: string[]
}

export type DailyAiNewsEditorialBrief = {
  intro: string
  items: DailyAiNewsEditorialItem[]
  trends: DailyAiNewsEditorialTrend[]
  warnings: string[]
}

type RichFactCard = AiNewsFactCard & Partial<{
  whatHappened: string
  whyItMatters: string
  keyDetails: string[]
  limitations: string[]
  communityDiscussion: string
  warnings: string[]
}>

type OpenAICompatibleChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

const MIN_DESCRIPTION_LENGTH = 80
const MIN_KEY_POINT_LENGTH = 28
const MIN_KEY_POINTS = 3

function readPositiveIntegerEnv(key: string, fallback: number) {
  const value = Number(process.env[key])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

const EDITORIAL_MAX_TOKENS = readPositiveIntegerEnv("AI_NEWS_EDITORIAL_MAX_TOKENS", 5200)

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function getRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function substantialLength(value: string) {
  return value.replace(/[\s"'`*_~\-—–，。！？、；：,.!?;:()[\]（）【】<>《》]+/g, "").length
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase()
}

function normalizeForSimilarity(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, "")
}

function hasSimilarCore(a: string, b: string) {
  const left = normalizeForSimilarity(a)
  const right = normalizeForSimilarity(b)

  if (!left || !right) {
    return false
  }
  if (left === right) {
    return true
  }

  const shorter = left.length < right.length ? left : right
  const longer = left.length < right.length ? right : left

  return shorter.length >= 24 && longer.includes(shorter)
}

function uniqueDistinctTexts(values: string[], comparisonTexts: string[] = []) {
  const accepted: string[] = []

  for (const value of values.map(compactText).filter(Boolean)) {
    if (accepted.some((item) => hasSimilarCore(item, value))) {
      continue
    }
    if (comparisonTexts.some((item) => hasSimilarCore(item, value))) {
      continue
    }
    accepted.push(value)
  }

  return accepted
}

function normalizeStringArray(value: unknown) {
  return getArray(value)
    .map((item) => getString(item))
    .filter(Boolean)
}

function extractFencedJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return fenced?.[1]?.trim() ?? null
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf("{")

  if (start === -1) {
    return null
  }

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
    if (inString) {
      continue
    }
    if (char === "{") {
      depth += 1
    }
    if (char === "}") {
      depth -= 1
      if (depth === 0) {
        return text.slice(start, index + 1)
      }
    }
  }

  return null
}

function extractAssistantText(payload: OpenAICompatibleChatPayload) {
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

function normalizeEditorialItem(value: unknown): DailyAiNewsEditorialItem | null {
  const record = getRecord(value)
  const sourceTitle = getString(record.sourceTitle) || getString(record.title)
  const editorialTitle = getString(record.editorialTitle) || getString(record.headline) || sourceTitle
  const description = compactText(getString(record.description))
  const impact = compactText(getString(record.impact))
  const sourceName = getString(record.sourceName) || getString(record.source)
  const url = getString(record.url)
  const keyPoints = uniqueDistinctTexts(
    [
      ...normalizeStringArray(record.keyPoints),
      ...normalizeStringArray(record.keyDetails),
      ...normalizeStringArray(record.key_points),
    ].filter((point) => substantialLength(point) >= MIN_KEY_POINT_LENGTH),
    [description, impact],
  ).slice(0, 5)

  if (!sourceTitle || !editorialTitle || !description || !sourceName || !url) {
    return null
  }
  if (substantialLength(description) < MIN_DESCRIPTION_LENGTH) {
    return null
  }
  if (keyPoints.length < MIN_KEY_POINTS) {
    return null
  }

  return {
    sourceTitle,
    editorialTitle,
    description,
    keyPoints,
    impact: impact || undefined,
    sourceName,
    url,
  }
}

function normalizeEditorialTrend(value: unknown): DailyAiNewsEditorialTrend | null {
  const record = getRecord(value)
  const title = getString(record.title)
  const desc = compactText(getString(record.desc) || getString(record.description))
  const evidenceTitles = normalizeStringArray(record.evidenceTitles).concat(normalizeStringArray(record.evidence))

  if (!title || substantialLength(desc) < 40) {
    return null
  }

  return {
    title,
    desc,
    evidenceTitles: uniqueDistinctTexts(evidenceTitles).slice(0, 5),
  }
}

function normalizeEditorialBrief(payload: unknown): DailyAiNewsEditorialBrief | null {
  const record = getRecord(payload)
  const intro = compactText(getString(record.intro) || getString(record.summary))
  const items = getArray(record.items)
    .map(normalizeEditorialItem)
    .filter((item): item is DailyAiNewsEditorialItem => Boolean(item))
  const trends = getArray(record.trends)
    .map(normalizeEditorialTrend)
    .filter((trend): trend is DailyAiNewsEditorialTrend => Boolean(trend))
    .slice(0, 5)
  const warnings = normalizeStringArray(record.warnings)

  if (substantialLength(intro) < 60 || items.length === 0) {
    return null
  }

  return {
    intro,
    items,
    trends,
    warnings,
  }
}

export function parseDailyAiNewsEditorialBrief(text: string): DailyAiNewsEditorialBrief | null {
  const trimmed = text.trim()

  if (!trimmed) {
    return null
  }

  const candidates = [
    trimmed,
    extractFencedJson(trimmed),
    extractFirstJsonObject(trimmed),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    try {
      const parsed = normalizeEditorialBrief(JSON.parse(candidate))
      if (parsed) {
        return parsed
      }
    } catch {
      // Try the next extraction strategy.
    }
  }

  return null
}

function cardByTitle(factCards: AiNewsFactCard[]) {
  const cards = new Map<string, RichFactCard>()

  for (const card of factCards) {
    const key = normalizeTitle(card.title)
    if (key && !cards.has(key)) {
      cards.set(key, card as RichFactCard)
    }
  }

  return cards
}

function buildEditorialDigest(candidates: AiNewsScoredCandidate[], factCards: AiNewsFactCard[]) {
  const cards = cardByTitle(factCards)

  return candidates
    .map((candidate, index) => {
      const card = cards.get(normalizeTitle(candidate.title))
      return [
        `item ${index + 1}`,
        `sourceTitle: ${candidate.title}`,
        `sourceName: ${candidate.sourceName}`,
        `sourceType: ${candidate.sourceType}`,
        `url: ${candidate.url}`,
        `publishedAt: ${candidate.publishedAt?.toISOString() ?? "unknown"}`,
        `aiSummary: ${candidate.aiSummary ?? ""}`,
        `sourceSummary: ${candidate.summary ?? ""}`,
        `factSummary: ${card?.summary ?? ""}`,
        `whatHappened: ${card?.whatHappened ?? ""}`,
        `whyItMatters: ${card?.whyItMatters ?? ""}`,
        `keyDetails: ${JSON.stringify(card?.keyDetails ?? [])}`,
        `limitations: ${JSON.stringify(card?.limitations ?? [])}`,
        `citations: ${JSON.stringify(card?.citations ?? [])}`,
      ].join("\n")
    })
    .join("\n\n")
}

export function buildDailyAiNewsEditorialPrompt({
  date,
  candidates,
  factCards,
}: {
  date: Date
  candidates: AiNewsScoredCandidate[]
  factCards: AiNewsFactCard[]
}) {
  const dateLabel = date.toISOString().slice(0, 10)

  return [
    `请基于以下候选事实卡生成 ${dateLabel} 中文 AI 日报的日级主编稿。`,
    "只输出严格 JSON，不要 Markdown 围栏或额外解释。",
    "JSON 字段：intro, items, trends, warnings。",
    "items 每项字段：sourceTitle, editorialTitle, description, keyPoints, impact, sourceName, url。",
    "trends 每项字段：title, desc, evidenceTitles。",
    "",
    "主编质量要求：",
    "1. intro 写 2-4 句，80-160 个中文字符，概括今天 AI 生态的主线，不要空泛寒暄。",
    "2. items 选择 8-12 条；如果候选不足，则使用全部候选。排序按读者价值和信息密度，不按来源顺序机械排列。",
    "3. editorialTitle 用中文重写，保留公司、产品、模型、仓库名和版本号；不要只写“版本动态/代理动态”。",
    "4. description 写 120-220 个中文字符，交代谁做了什么、具体变化、使用场景、约束或背景。",
    "5. keyPoints 写 3-5 条，每条 35-90 个中文字符；分别覆盖具体功能/数据、影响对象、限制风险、后续看点等不同角度。",
    "6. impact 写 60-120 个中文字符，说明对开发者、产品团队、企业、研究或监管的实际影响。",
    "7. 禁止把 description 的同一句话复制到 keyPoints；禁止重复使用“值得关注、详情以来源链接为准、持续观察”等空话。",
    "8. 只使用候选事实卡提供的事实。事实卡缺少细节时，在 warnings 中说明，不要补造数字、发布日期或功能。",
    "9. trends 写 3-5 条，每条必须引用 evidenceTitles 中的 2 个以内代表新闻标题作为依据；候选不足时可写 1-2 条。",
    "",
    `候选事实卡：\n${buildEditorialDigest(candidates, factCards)}`,
  ].join("\n")
}

export async function generateDailyAiNewsEditorialBrief({
  date,
  candidates,
  factCards,
  aiModel,
  fetchImpl = fetch,
}: {
  date: Date
  candidates: AiNewsScoredCandidate[]
  factCards: AiNewsFactCard[]
  aiModel: AiModelOption
  fetchImpl?: typeof fetch
}): Promise<DailyAiNewsEditorialBrief | null> {
  if (candidates.length === 0 || factCards.length === 0) {
    return null
  }

  try {
    const response = await fetchImpl(`${aiModel.baseUrl.replace(/\/+$/, "")}${aiModel.requestPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(aiModel.apiKey ? { Authorization: `Bearer ${aiModel.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: aiModel.model,
        messages: [
          {
            role: "system",
            content: "你是严谨的中文 AI 日报主编。你只基于给定事实卡写作，输出必须是可解析 JSON。",
          },
          {
            role: "user",
            content: buildDailyAiNewsEditorialPrompt({ date, candidates, factCards }),
          },
        ],
        temperature: 0.25,
        max_tokens: EDITORIAL_MAX_TOKENS,
        ...getAiModelChatRequestExtras(aiModel),
      }),
    })
    const payload = await response.json().catch(() => null) as OpenAICompatibleChatPayload | null

    if (!response.ok || !payload) {
      return null
    }

    const assistantText = extractAssistantText(payload)
    const brief = assistantText ? parseDailyAiNewsEditorialBrief(assistantText) : null
    const minimumItemCount = Math.min(6, candidates.length)

    if (!brief || brief.items.length < minimumItemCount) {
      return null
    }

    return brief
  } catch {
    return null
  }
}
