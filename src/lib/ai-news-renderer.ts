/**
 * AI 日报 Markdown 渲染器。
 *
 * 职责：
 * - 把已筛选候选与事实卡转成最终可发布的 Markdown 正文
 * - 使用事实卡的 whatHappened / whyItMatters / keyDetails 输出详细条目
 * - 统一来源链接、标题展示与生成模型标注格式
 */
import type { AiModelOption } from "@/lib/ai-models"
import type { AiNewsFactCard, AiNewsScoredCandidate, AiNewsSourceType } from "@/lib/ai-news-types"

export type DailyAiNewsRendererInput = {
  date: Date
  selectedCandidates: AiNewsScoredCandidate[]
  factCards: AiNewsFactCard[]
  aiModel: Pick<AiModelOption, "name" | "model">
}

type RichFactCard = AiNewsFactCard & Partial<{
  whatHappened: string
  whyItMatters: string
  keyDetails: string[]
  communityDiscussion: string
  limitations: string[]
  warnings: string[]
}>

type CandidateFact = {
  candidate: AiNewsScoredCandidate
  factCard?: RichFactCard
}

type CandidateDisplayLabels = Map<string, string>

type CategoryKey = "developer" | "research" | "business"

type TrendKey = "multimodal" | "developer" | "model" | "infrastructure" | "safety" | "business" | "community" | "general"

type NewsItemRendererInput = {
  fact: CandidateFact
  displayLabels: CandidateDisplayLabels
  index: number
}

const CATEGORY_TITLES: Record<CategoryKey, string> = {
  developer: "开源与开发者动态",
  research: "模型与研究进展",
  business: "产品与商业动态",
}

const SOURCE_TYPE_LABELS: Record<AiNewsSourceType, string> = {
  RSS: "行业动态",
  HACKERNEWS: "社区讨论",
  GITHUB_RELEASES: "版本动态",
  GITHUB_TRENDING_RSS: "开源趋势",
  REDDIT: "社区讨论",
}

const ENGLISH_TOPIC_STOPWORDS = new Set(["a", "an", "and", "how", "major", "new", "the", "this", "useful", "what", "why"])

const CATEGORY_KEYWORDS: Record<CategoryKey, string[]> = {
  developer: ["github", "开源", "开发者", "developer", "release", "releases", "sdk", "api", "tool", "工具", "框架"],
  research: ["model", "模型", "research", "研究", "paper", "论文", "benchmark", "eval", "训练", "推理"],
  business: ["product", "产品", "business", "商业", "startup", "融资", "enterprise", "pricing", "market", "客户"],
}

const TREND_DEFINITIONS: Array<{
  key: TrendKey
  title: string
  keywords: string[]
}> = [
  {
    key: "multimodal",
    title: "多模态交互加速落地",
    keywords: ["audio", "image", "video", "voice", "realtime", "speech", "translate", "translation", "语音", "图像", "视频", "多模态", "实时", "翻译"],
  },
  {
    key: "developer",
    title: "开发者工具链继续成熟",
    keywords: ["github", "sdk", "api", "developer", "release", "open source", "opensource", "开源", "开发者", "工具", "框架", "版本"],
  },
  {
    key: "model",
    title: "模型能力迭代保持高频",
    keywords: ["model", "llm", "gpt", "reasoning", "benchmark", "eval", "paper", "research", "模型", "推理", "论文", "研究", "评测", "基准"],
  },
  {
    key: "infrastructure",
    title: "算力与基础设施走向工程化",
    keywords: ["gpu", "chip", "cloud", "inference", "datacenter", "infrastructure", "芯片", "算力", "云", "推理服务", "基础设施", "数据中心"],
  },
  {
    key: "safety",
    title: "安全与合规成为基础能力",
    keywords: ["security", "safety", "privacy", "policy", "regulation", "compliance", "lawsuit", "安全", "隐私", "监管", "合规", "诉讼", "治理"],
  },
  {
    key: "business",
    title: "AI 产品化与商业化扩张",
    keywords: ["product", "business", "enterprise", "pricing", "funding", "startup", "hardware", "market", "产品", "商业", "企业", "定价", "融资", "硬件", "市场"],
  },
  {
    key: "community",
    title: "社区反馈影响技术路线",
    keywords: ["hacker news", "reddit", "community", "discussion", "comments", "社区", "讨论", "反馈"],
  },
]

const TREND_FALLBACK: { key: TrendKey; title: string } = {
  key: "general",
  title: "AI 生态热点持续分化",
}

const DETAIL_EMOJIS = ["🔊", "🌐", "📝", "🧠", "🛡️", "🤖", "🔧", "🏗️", "📈", "🚀"]

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase()
}

function escapeMarkdownInline(value: string) {
  return value.replace(/([\\`*_\[\]])/g, "\\$1")
}

function hasCjk(value: string | null | undefined) {
  return /[\u3400-\u9fff]/.test(value ?? "")
}

function preferChineseText(values: Array<string | null | undefined>, fallback: string) {
  const compacted = values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))
  return compacted.find(hasCjk) ?? compacted[0] ?? fallback
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function readText(value: string | null | undefined) {
  return compactText(value ?? "")
}

function trimTrailingSentencePunctuation(value: string) {
  return value.replace(/[。！？!?；;，,.\s]+$/g, "")
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value
  return `${value.slice(0, maxLength - 1).trim()}…`
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }

  return result
}

function uniqueByUrl(values: Array<{ label: string; url: string; sourceName: string }>) {
  const seen = new Set<string>()
  const result: Array<{ label: string; url: string; sourceName: string }> = []

  for (const value of values) {
    const key = value.url.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    result.push({ ...value, url: key })
  }

  return result
}

function mapCandidateFacts(selectedCandidates: AiNewsScoredCandidate[], factCards: AiNewsFactCard[]): CandidateFact[] {
  const cardsByTitle = new Map<string, RichFactCard>()
  for (const card of factCards) {
    const key = normalizeTitle(card.title)
    if (key && !cardsByTitle.has(key)) {
      cardsByTitle.set(key, card as RichFactCard)
    }
  }

  return selectedCandidates.map((candidate) => ({
    candidate,
    factCard: cardsByTitle.get(normalizeTitle(candidate.title)),
  }))
}

function candidateTags(candidate: AiNewsScoredCandidate) {
  return [
    candidate.sourceType,
    candidate.title,
    candidate.sourceName,
    ...candidate.aiTags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function candidateEditorialText(candidate: AiNewsScoredCandidate) {
  return [
    candidate.title,
    candidate.sourceName,
    candidate.aiSummary,
    candidate.summary,
    candidate.content,
    ...candidate.aiTags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
}

function candidateDescriptor(candidate: AiNewsScoredCandidate) {
  if (candidate.sourceType !== "RSS") {
    return SOURCE_TYPE_LABELS[candidate.sourceType]
  }

  const text = candidateEditorialText(candidate)

  if (/(融资|估值|投资|市值|ipo|valuation|funding|invest|billion|million|trillion|亿美元|万亿)/i.test(text)) {
    return "资本动态"
  }
  if (/(广告|商业化|收入|定价|客户|企业|ads?|advertis|pricing|revenue|enterprise|customer)/i.test(text)) {
    return "商业化动态"
  }
  if (/(芯片|算力|云|基础设施|gpu|cpu|cloud|infrastructure|datacenter|data center|semiconductor)/i.test(text)) {
    return "基础设施动态"
  }
  if (/(代理|助手|agent|assistant|workflow|自动化)/i.test(text)) {
    return "代理动态"
  }
  if (/(诉讼|监管|合规|安全|风险|和解|lawsuit|settlement|regulation|safety|policy)/i.test(text)) {
    return "治理动态"
  }
  if (/(模型|研究|论文|benchmark|eval|research|paper|model)/i.test(text)) {
    return "模型动态"
  }

  return SOURCE_TYPE_LABELS.RSS
}

function classifyCandidate(candidate: AiNewsScoredCandidate): CategoryKey {
  const text = candidateTags(candidate)

  if (candidate.sourceType === "GITHUB_RELEASES" || candidate.sourceType === "GITHUB_TRENDING_RSS") {
    return "developer"
  }

  for (const key of Object.keys(CATEGORY_KEYWORDS) as CategoryKey[]) {
    if (CATEGORY_KEYWORDS[key].some((keyword) => text.includes(keyword.toLowerCase()))) {
      return key
    }
  }

  const sourceDefaults: Partial<Record<AiNewsSourceType, CategoryKey>> = {
    HACKERNEWS: "developer",
    REDDIT: "developer",
    RSS: "business",
  }

  return sourceDefaults[candidate.sourceType] ?? "business"
}

function candidateSummary({ candidate, factCard }: CandidateFact) {
  const preferred = compactText(preferChineseText([factCard?.summary, candidate.aiSummary, candidate.summary, candidate.content], ""))

  if (preferred && hasCjk(preferred)) {
    return preferred
  }

  return `来自 ${candidate.sourceName} 的 AI 动态，具体细节以来源链接为准。`
}

function candidateDescription({ candidate, factCard }: CandidateFact) {
  const preferred = compactText(preferChineseText(
    [factCard?.whatHappened, factCard?.summary, candidate.aiSummary, candidate.summary, candidate.content],
    "",
  ))

  if (preferred && hasCjk(preferred)) {
    return preferred
  }

  return candidateSummary({ candidate, factCard })
}

function extractEnglishTopic(value: string) {
  const compacted = compactText(value)
  const topicMatch = compacted.match(/^([A-Za-z0-9][A-Za-z0-9_.@/-]{1,48})(?:\s+([A-Za-z]*\d[A-Za-z0-9_.@/-]{0,32}))?/)
  const firstToken = topicMatch?.[1] ?? ""
  const versionToken = topicMatch?.[2] ?? ""

  if (!firstToken) return ""
  if (/[/.@_-]/.test(firstToken) || /\d/.test(firstToken) || /^[A-Z0-9]+$/.test(firstToken) || /AI|LLM|GPT|ML|SDK|API/.test(firstToken)) {
    return [firstToken, versionToken].filter(Boolean).join(" ")
  }
  if (/^[A-Z][A-Za-z0-9]{2,}$/.test(firstToken) && !ENGLISH_TOPIC_STOPWORDS.has(firstToken.toLowerCase())) {
    return [firstToken, versionToken].filter(Boolean).join(" ")
  }

  return ""
}

function candidateDisplayTitle(fact: CandidateFact) {
  const { candidate, factCard } = fact
  const chineseTitle = [factCard?.title, candidate.title]
    .map((value) => value?.trim())
    .find((value): value is string => Boolean(value && hasCjk(value)))

  if (chineseTitle) {
    return truncateText(trimTrailingSentencePunctuation(compactText(chineseTitle)), 42)
  }

  const topic = extractEnglishTopic(candidate.title)
  const label = candidateDescriptor(candidate)

  return truncateText(`${topic || candidate.sourceName} ${label}`, 34)
}

function buildDisplayLabels(candidateFacts: CandidateFact[]): CandidateDisplayLabels {
  const baseLabels = candidateFacts.map((fact) => candidateDisplayTitle(fact))
  const totals = baseLabels.reduce<Map<string, number>>((counts, label) => {
    counts.set(label, (counts.get(label) ?? 0) + 1)
    return counts
  }, new Map())
  const seen = new Map<string, number>()
  const labels: CandidateDisplayLabels = new Map()

  candidateFacts.forEach((fact, index) => {
    const baseLabel = baseLabels[index]
    const total = totals.get(baseLabel) ?? 0
    if (total <= 1) {
      labels.set(fact.candidate.id, baseLabel)
      return
    }

    const current = (seen.get(baseLabel) ?? 0) + 1
    seen.set(baseLabel, current)
    labels.set(fact.candidate.id, `${baseLabel}（${current}）`)
  })

  return labels
}

function candidateSourceUrls({ candidate, factCard }: CandidateFact) {
  const citationUrls = factCard?.citations.map((citation) => citation.url.trim()).filter(Boolean) ?? []
  return uniqueStrings(citationUrls.length > 0 ? citationUrls : [candidate.url])
}

function renderWelcomeIntro(date: Date) {
  return `欢迎来到【AI日报】栏目！今天是 ${formatDate(date)}，这里是你每天探索人工智能世界的指南。每天我们为你呈现 AI 领域的热点内容，聚焦开发者，助你洞悉技术趋势、了解创新 AI 产品应用。`
}

function renderOverview(candidateFacts: CandidateFact[], categorized: Record<CategoryKey, CandidateFact[]>) {
  if (candidateFacts.length === 0) {
    return [
      "今日暂未筛选出足够可靠的 AI 新闻候选。",
      "请稍后重新运行日报任务，或检查信息源和模型配置是否正常。",
    ]
  }

  const categoryLabels = (Object.keys(CATEGORY_TITLES) as CategoryKey[])
    .filter((key) => categorized[key].length > 0)
    .map((key) => CATEGORY_TITLES[key].replace("动态", ""))
  const coverage = categoryLabels.length > 0 ? categoryLabels.join("、") : "模型、产品与开发者生态"
  const topTitles = candidateFacts
    .slice(0, 3)
    .map((fact) => candidateDisplayTitle(fact))
    .join("、")

  return [
    `今日共筛选出 ${candidateFacts.length} 条值得跟进的 AI 动态，覆盖${coverage}。`,
    topTitles ? `最值得先读的线索包括：${topTitles}。` : "重点线索集中在模型能力、产品落地和开发者工具链。",
    "下文按重要性展开每条新闻，并保留来源链接以便继续追踪原始信息。",
  ]
}

function keyDetailsForFact(fact: CandidateFact) {
  const details = uniqueStrings(
    (fact.factCard?.keyDetails ?? [])
      .map(readText)
      .filter((detail) => detail.length > 0),
  )

  if (details.length > 0) {
    return details.slice(0, 5)
  }

  return [candidateSummary(fact)]
}

function renderNewsItem({ fact, displayLabels, index }: NewsItemRendererInput) {
  const { candidate, factCard } = fact
  const title = displayLabels.get(candidate.id) ?? candidateDisplayTitle(fact)
  const description = candidateDescription(fact)
  const detailLines = keyDetailsForFact(fact).map((detail, detailIndex) => `${DETAIL_EMOJIS[detailIndex % DETAIL_EMOJIS.length]} ${detail}`)
  const firstCitation = factCard?.citations[0]
  const sourceName = firstCitation?.sourceName || candidate.sourceName
  const sourceUrl = firstCitation?.url || candidate.url

  return [
    `### ${index}、${escapeMarkdownInline(title)}`,
    "",
    description,
    "",
    "【AiBase提要:】",
    "",
    ...detailLines,
    "",
    `> 来源：[${escapeMarkdownInline(sourceName)}](${sourceUrl})`,
  ].join("\n")
}

function inferTrend(fact: CandidateFact) {
  const text = [
    candidateEditorialText(fact.candidate),
    fact.factCard?.whyItMatters,
    fact.factCard?.keyDetails?.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  return TREND_DEFINITIONS.find((definition) => definition.keywords.some((keyword) => text.includes(keyword.toLowerCase()))) ?? TREND_FALLBACK
}

function trendSignalText(fact: CandidateFact) {
  return compactText(preferChineseText(
    [fact.factCard?.whyItMatters, fact.factCard?.summary, fact.candidate.aiSummary, fact.candidate.summary],
    candidateSummary(fact),
  ))
}

function renderTrendDescription(facts: CandidateFact[]) {
  const signals = uniqueStrings(facts.map(trendSignalText).filter(Boolean))
  const primary = signals[0] ?? "相关动态仍需结合来源继续观察。"
  const prefix = facts.length > 1 ? "多条动态显示，" : ""
  return truncateText(`${prefix}${trimTrailingSentencePunctuation(primary)}。`, 110)
}

function renderTrendSummary(candidateFacts: CandidateFact[], displayLabels: CandidateDisplayLabels) {
  if (candidateFacts.length === 0) {
    return [
      "## 今日趋势总结",
      "",
      "综合今日动态，AI 领域暂未形成足够清晰的趋势信号。",
    ].join("\n")
  }

  const grouped = new Map<TrendKey, { title: string; facts: CandidateFact[]; firstIndex: number }>()
  candidateFacts.forEach((fact, index) => {
    const trend = inferTrend(fact)
    const existing = grouped.get(trend.key)
    if (existing) {
      existing.facts.push(fact)
      return
    }
    grouped.set(trend.key, { title: trend.title, facts: [fact], firstIndex: index })
  })

  const trends = [...grouped.values()]
    .sort((a, b) => b.facts.length - a.facts.length || a.firstIndex - b.firstIndex)
    .slice(0, 5)
    .map((trend) => ({
      title: trend.title,
      desc: renderTrendDescription(trend.facts),
    }))

  const usedTitles = new Set(trends.map((trend) => trend.title))
  for (const fact of candidateFacts) {
    if (trends.length >= Math.min(3, candidateFacts.length)) break
    const title = `${displayLabels.get(fact.candidate.id) ?? candidateDisplayTitle(fact)} 释放单点信号`
    if (usedTitles.has(title)) continue
    usedTitles.add(title)
    trends.push({
      title,
      desc: renderTrendDescription([fact]),
    })
  }

  return [
    "## 今日趋势总结",
    "",
    "综合今日动态，AI 领域呈现以下趋势：",
    ...trends.map((trend, index) => `${index + 1}. **${escapeMarkdownInline(trend.title)}** — ${trend.desc}`),
  ].join("\n")
}

/**
 * 生成 AI 日报最终 Markdown。
 * 输入必须是“已完成筛选”的候选集，避免正文中混入低质量或重复项。
 */
export function renderDailyAiNewsMarkdown({
  date,
  selectedCandidates,
  factCards,
  aiModel,
}: DailyAiNewsRendererInput) {
  const candidateFacts = mapCandidateFacts(selectedCandidates, factCards)
  const displayLabels = buildDisplayLabels(candidateFacts)
  const dateLabel = formatDate(date)
  const categorized = candidateFacts.reduce<Record<CategoryKey, CandidateFact[]>>(
    (groups, fact) => {
      groups[classifyCandidate(fact.candidate)].push(fact)
      return groups
    },
    { developer: [], research: [], business: [] },
  )
  const sourceReferences = uniqueByUrl(candidateFacts.flatMap((fact) =>
    candidateSourceUrls(fact).map(
      (url) => ({
        label: displayLabels.get(fact.candidate.id) ?? candidateDisplayTitle(fact),
        url,
        sourceName: fact.candidate.sourceName,
      }),
    ),
  ))
  const sourceLines = sourceReferences.map(
    (reference) => `- [${escapeMarkdownInline(reference.label)}](${reference.url}) — ${escapeMarkdownInline(reference.sourceName)}`,
  )

  return [
    `# ${dateLabel} AI 日报`,
    "",
    renderWelcomeIntro(date),
    "",
    "## 今日摘要",
    ...renderOverview(candidateFacts, categorized),
    "",
    "## 今日重点",
    ...(candidateFacts.length > 0
      ? candidateFacts.map((fact, index) => renderNewsItem({ fact, displayLabels, index: index + 1 }))
      : ["暂无入选新闻。"]),
    "",
    renderTrendSummary(candidateFacts, displayLabels),
    "",
    "## 来源链接",
    ...(sourceLines.length > 0 ? sourceLines : ["- 暂无来源链接。"]),
    "",
    "---",
    "",
    `> 生成标注：本文由 AI 模型 **${escapeMarkdownInline(aiModel.name)}**（${escapeMarkdownInline(aiModel.model)}）生成，基于上方公开来源整理。`,
  ]
    .join("\n")
    .trim()
}
