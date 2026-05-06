import type {
  AiNewsCandidateInput,
  AiNewsFactCard,
  AiNewsJsonObject,
} from "@/lib/ai-news-types"

type OpenAICompatibleModel = {
  baseUrl: string
  requestPath?: string
  model: string
  apiKey?: string
}

type GenerateFactCardForCandidateInput = {
  candidate: AiNewsCandidateInput
  aiModel: OpenAICompatibleModel
  fetchImpl?: typeof fetch
}

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

export type AiNewsFactCardCitation = AiNewsFactCard["citations"][number]

export type AiNewsEnrichedFactCard = AiNewsFactCard & {
  whatHappened: string
  whyItMatters: string
  keyDetails: string[]
  limitations: string[]
  communityDiscussion: string
  warnings: string[]
}

const VALID_CONFIDENCE = new Set(["low", "medium", "high"])

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function hasCjk(value: string | null | undefined) {
  return /[\u3400-\u9fff]/.test(value ?? "")
}

function firstChineseText(values: Array<string | null | undefined>, fallback: string) {
  const compacted = values.map((value) => value?.replace(/\s+/g, " ").trim()).filter((value): value is string => Boolean(value))
  return compacted.find(hasCjk) ?? fallback
}

function getOptionalObject(value: unknown): AiNewsJsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as AiNewsJsonObject
    : {}
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeCitations(value: unknown): AiNewsFactCardCitation[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((item) => getOptionalObject(item))
    .map((item) => ({
      title: getString(item.title) || undefined,
      url: getString(item.url),
      sourceName: getString(item.sourceName) || undefined,
    }))
    .filter((item) => Boolean(item.url))
}

function canonicalizeCitationUrl(value: string) {
  try {
    const url = new URL(value)
    url.hash = ""
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_") || key.toLowerCase() === "fbclid" || key.toLowerCase() === "gclid") {
        url.searchParams.delete(key)
      }
    }
    url.searchParams.sort()
    url.hostname = url.hostname.replace(/^www\./i, "")
    return url.toString().replace(/\/$/, "")
  } catch {
    return value.trim().replace(/\?.*$/, "").replace(/\/$/, "").replace(/^https?:\/\/www\./i, (prefix) => prefix.replace("www.", "")).toLowerCase()
  }
}

function appendWarning(card: AiNewsEnrichedFactCard, warning: string): AiNewsEnrichedFactCard {
  return {
    ...card,
    warnings: [...card.warnings, warning],
  }
}

function fallbackFactCard(candidate: AiNewsCandidateInput, warning: string): AiNewsEnrichedFactCard {
  const summary = firstChineseText(
    [candidate.summary, candidate.content],
    `来自 ${candidate.sourceName} 的 AI 动态，详情以来源链接为准。`,
  )
  const community = getOptionalObject(candidate.community)
  const metadata = getOptionalObject(candidate.metadata)
  const discussionUrl = getString(metadata.discussionUrl) || getString(community.discussionUrl)
  const citations = [
    {
      title: candidate.sourceName,
      url: candidate.canonicalUrl || candidate.url,
      sourceName: candidate.sourceName,
    },
    ...(discussionUrl ? [{
      title: "社区讨论",
      url: discussionUrl,
      sourceName: "社区",
    }] : []),
  ]

  return validateFactCardCitations({
    title: candidate.title,
    summary,
    whatHappened: summary,
    whyItMatters: "该条目入选今日 AI 日报，但事实卡未能由模型可靠生成，需以来源链接为准。",
    keyDetails: [
      `来源：${candidate.sourceName}`,
      `链接：${candidate.canonicalUrl || candidate.url}`,
    ],
    limitations: ["因事实卡生成失败，本条仅使用候选元数据生成保守摘要。"],
    communityDiscussion: discussionUrl ? "候选元数据中包含社区讨论链接。" : "候选元数据中未提供社区讨论信息。",
    citations,
    confidence: "low",
    warnings: [warning],
  }, candidate)
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

function parseFactCardResponse(text: string): AiNewsEnrichedFactCard | null {
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
      const parsed = normalizeFactCard(JSON.parse(candidate))
      if (parsed) {
        return parsed
      }
    } catch {
      // Try the next extraction strategy.
    }
  }

  return null
}

function normalizeFactCard(payload: unknown): AiNewsEnrichedFactCard | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null
  }

  const record = payload as Record<string, unknown>
  const title = getString(record.title)
  const summary = getString(record.summary)

  if (!title || !summary) {
    return null
  }

  const confidence = getString(record.confidence).toLowerCase()

  return {
    title,
    summary,
    whatHappened: getString(record.whatHappened),
    whyItMatters: getString(record.whyItMatters),
    keyDetails: normalizeStringArray(record.keyDetails),
    limitations: normalizeStringArray(record.limitations),
    communityDiscussion: getString(record.communityDiscussion),
    citations: normalizeCitations(record.citations),
    confidence: VALID_CONFIDENCE.has(confidence) ? confidence as AiNewsEnrichedFactCard["confidence"] : "low",
    warnings: normalizeStringArray(record.warnings),
  }
}

function buildFactCardPrompt(candidate: AiNewsCandidateInput) {
  return [
    "Create a conservative fact card for a Chinese AI daily briefing.",
    "Write summary/whatHappened/whyItMatters/keyDetails/limitations/communityDiscussion/warnings in Simplified Chinese.",
    "If the source material is English, translate the editorial fields into natural Simplified Chinese while preserving product, company, model, and repository names.",
    "Return strict JSON only with fields: title/summary/whatHappened/whyItMatters/keyDetails/limitations/communityDiscussion/citations/confidence/warnings.",
    "Only cite URLs present in the candidate data. Do not invent citations. Use warnings for uncertainty or missing evidence.",
    "",
    `Title: ${candidate.title}`,
    `URL: ${candidate.url}`,
    `Canonical URL: ${candidate.canonicalUrl}`,
    `Source: ${candidate.sourceName} (${candidate.sourceType})`,
    `Published at: ${candidate.publishedAt?.toISOString() ?? "unknown"}`,
    `Summary: ${candidate.summary ?? ""}`,
    `Content: ${candidate.content ?? ""}`,
    `Metadata: ${JSON.stringify(candidate.metadata ?? {})}`,
    `Community: ${JSON.stringify(candidate.community ?? {})}`,
    `Merged sources: ${JSON.stringify(candidate.mergedSources ?? [])}`,
  ].join("\n")
}

function getAllowedCitationUrls(candidate: AiNewsCandidateInput) {
  const metadata = getOptionalObject(candidate.metadata)
  const community = getOptionalObject(candidate.community)
  const urls = [
    candidate.url,
    candidate.canonicalUrl,
    getString(metadata.discussionUrl),
    getString(community.discussionUrl),
    getString(metadata.homepage),
    getString(metadata.sourceUrl),
    ...(candidate.mergedSources ?? []).map((source) => source.url),
  ]

  return new Map(urls.filter(Boolean).map((url) => [canonicalizeCitationUrl(url), url]))
}

export function validateFactCardCitations(
  card: AiNewsEnrichedFactCard,
  candidate: AiNewsCandidateInput,
): AiNewsEnrichedFactCard {
  const allowedUrls = getAllowedCitationUrls(candidate)
  const seen = new Set<string>()
  const validatedCitations = card.citations.flatMap((citation) => {
    const key = canonicalizeCitationUrl(citation.url)
    const allowedUrl = allowedUrls.get(key)
    if (!allowedUrl || seen.has(key)) {
      return []
    }

    seen.add(key)
    return [{
      ...citation,
      url: allowedUrl,
      sourceName: citation.sourceName || candidate.sourceName,
    }]
  })
  const removedCount = card.citations.length - validatedCitations.length

  if (validatedCitations.length === 0) {
    return appendWarning({
      ...card,
      citations: [{
        title: candidate.sourceName,
        url: candidate.canonicalUrl || candidate.url,
        sourceName: candidate.sourceName,
      }],
    }, removedCount > 0
      ? `Removed ${removedCount} citation URL(s) outside the candidate whitelist; fell back to the candidate source URL.`
      : "No citation was provided by the model; fell back to the candidate source URL.")
  }

  if (removedCount === 0) {
    return {
      ...card,
      citations: validatedCitations,
    }
  }

  const suffix = removedCount === 1 ? "citation URL" : "citation URLs"
  return appendWarning({
    ...card,
    citations: validatedCitations,
  }, `Removed ${removedCount} citation with unknown ${suffix}.`)
}

export function calculateCitationCoverage(cards: Array<Pick<AiNewsFactCard, "citations">>) {
  if (cards.length === 0) {
    return 0
  }

  return cards.filter((card) => card.citations.length > 0).length / cards.length
}

export async function generateFactCardForCandidate({
  candidate,
  aiModel,
  fetchImpl = fetch,
}: GenerateFactCardForCandidateInput): Promise<AiNewsEnrichedFactCard> {
  try {
    const requestPath = aiModel.requestPath ?? "/chat/completions"
    const response = await fetchImpl(`${aiModel.baseUrl.replace(/\/+$/, "")}${requestPath}`, {
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
            content: "You write grounded AI news fact cards. Return strict JSON only and never invent citations.",
          },
          {
            role: "user",
            content: buildFactCardPrompt(candidate),
          },
        ],
        temperature: 0.2,
      }),
    })

    const payload = await response.json().catch(() => null) as OpenAICompatibleChatPayload | null
    const upstreamError = payload?.error?.message

    if (!response.ok) {
      return fallbackFactCard(candidate, upstreamError || `AI fact card request failed with HTTP ${response.status}`)
    }

    if (!payload) {
      return fallbackFactCard(candidate, "AI fact card response body was not valid JSON")
    }

    const assistantText = extractAssistantText(payload)
    if (!assistantText) {
      return fallbackFactCard(candidate, "AI fact card response did not include assistant content")
    }

    const card = parseFactCardResponse(assistantText)
    if (!card) {
      return fallbackFactCard(candidate, "AI fact card response was not valid JSON")
    }

    return validateFactCardCitations(card, candidate)
  } catch (error) {
    return fallbackFactCard(candidate, error instanceof Error ? error.message : "AI fact card request failed")
  }
}
