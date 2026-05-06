import type { AiModelOption } from "@/lib/ai-models"
import type { AiNewsFactCard, AiNewsScoredCandidate, AiNewsSourceType } from "@/lib/ai-news-types"

export type DailyAiNewsRendererInput = {
  date: Date
  selectedCandidates: AiNewsScoredCandidate[]
  factCards: AiNewsFactCard[]
  aiModel: Pick<AiModelOption, "name" | "model">
}

type CandidateFact = {
  candidate: AiNewsScoredCandidate
  factCard?: AiNewsFactCard
}

type CandidateDisplayLabels = Map<string, string>

type CategoryKey = "developer" | "research" | "business"

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
  const cardsByTitle = new Map<string, AiNewsFactCard>()
  for (const card of factCards) {
    const key = normalizeTitle(card.title)
    if (key && !cardsByTitle.has(key)) {
      cardsByTitle.set(key, card)
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
  const preferred = compactText(preferChineseText([factCard?.summary, candidate.aiSummary, candidate.summary], ""))

  if (preferred && hasCjk(preferred)) {
    return preferred
  }

  return `来自 ${candidate.sourceName} 的 AI 动态，具体细节以来源链接为准。`
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

function renderBullet(fact: CandidateFact, displayLabels: CandidateDisplayLabels) {
  return `- **${escapeMarkdownInline(displayLabels.get(fact.candidate.id) ?? candidateDisplayTitle(fact))}**：${escapeMarkdownInline(candidateSummary(fact))}`
}

function renderOverview(candidateFacts: CandidateFact[], categorized: Record<CategoryKey, CandidateFact[]>) {
  const categoryLabels = (Object.keys(CATEGORY_TITLES) as CategoryKey[])
    .filter((key) => categorized[key].length > 0)
    .map((key) => CATEGORY_TITLES[key].replace("动态", ""))
  const coverage = categoryLabels.length > 0 ? categoryLabels.join("、") : "模型、产品与开发者生态"

  return [
    `今日共筛选出 ${candidateFacts.length} 条值得跟进的 AI 动态，覆盖${coverage}。`,
    "下文按重要性与主题拆分，避免同一条新闻在多个板块重复展开；所有判断均以来源链接和候选摘要为边界。",
  ]
}

export function renderDailyAiNewsMarkdown({
  date,
  selectedCandidates,
  factCards,
  aiModel,
}: DailyAiNewsRendererInput) {
  const candidateFacts = mapCandidateFacts(selectedCandidates, factCards)
  const displayLabels = buildDisplayLabels(candidateFacts)
  const dateLabel = formatDate(date)
  const topFacts = candidateFacts.slice(0, 3)
  const topFactIds = new Set(topFacts.map((fact) => fact.candidate.id))
  const categorized = candidateFacts.reduce<Record<CategoryKey, CandidateFact[]>>(
    (groups, fact) => {
      groups[classifyCandidate(fact.candidate)].push(fact)
      return groups
    },
    { developer: [], research: [], business: [] },
  )
  const categorizedRemainder = (Object.keys(categorized) as CategoryKey[]).reduce<Record<CategoryKey, CandidateFact[]>>(
    (groups, key) => {
      groups[key] = categorized[key].filter((fact) => !topFactIds.has(fact.candidate.id))
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
    "## 今日摘要",
    ...renderOverview(candidateFacts, categorized),
    "",
    "## 最重要的 3 件事",
    ...(topFacts.length > 0 ? topFacts.map((fact) => renderBullet(fact, displayLabels)) : ["- 暂无入选新闻。"]),
    "",
    ...(["developer", "research", "business"] as CategoryKey[]).flatMap((key) =>
      categorizedRemainder[key].length > 0
        ? [
            `## ${CATEGORY_TITLES[key]}`,
            ...categorizedRemainder[key].map((fact) => renderBullet(fact, displayLabels)),
            "",
          ]
        : [],
    ),
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
