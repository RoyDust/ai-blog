import type {
  AiNewsCandidateInput,
  AiNewsScoredCandidate,
  AiNewsScoreResult,
  AiNewsSelectionResult,
  AiNewsSourceType,
} from "@/lib/ai-news-types"

type OpenAICompatibleModel = {
  baseUrl: string
  requestPath?: string
  model: string
  apiKey?: string
}

type ScoreAiNewsCandidateInput = {
  candidate: AiNewsCandidateInput
  aiModel: OpenAICompatibleModel
  fetchImpl?: typeof fetch
}

type SelectScoredCandidatesInput = {
  candidates: AiNewsScoredCandidate[]
  threshold?: number
  maxSelected?: number
  sourceDiversity?: false | {
    maxPerSourceType?: number
    maxShare?: number
  }
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

const EXCLUSION_RISK_FLAGS = new Set(["hallucination", "duplicate"])
const DOWNRANK_RISK_FLAGS = new Set(["low-signal"])

function clampScore(score: unknown) {
  const parsed = typeof score === "number" ? score : Number(score)

  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, Math.min(10, parsed))
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

function normalizeScorePayload(payload: unknown): AiNewsScoreResult {
  if (!payload || typeof payload !== "object") {
    return invalidScore("AI score response JSON must be an object")
  }

  const record = payload as Record<string, unknown>

  return {
    score: clampScore(record.score),
    reason: typeof record.reason === "string" ? record.reason.trim() : "",
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    tags: normalizeStringArray(record.tags),
    riskFlags: normalizeStringArray(record.riskFlags).map((flag) => flag.toLowerCase()),
  }
}

function invalidScore(message: string): AiNewsScoreResult {
  return {
    score: 0,
    reason: message,
    summary: "",
    tags: [],
    riskFlags: [],
    error: message,
  }
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

export function parseAiNewsScoreResponse(text: string): AiNewsScoreResult {
  const trimmed = text.trim()

  if (!trimmed) {
    return invalidScore("AI score response was empty")
  }

  const candidates = [
    trimmed,
    extractFencedJson(trimmed),
    extractFirstJsonObject(trimmed),
  ].filter((candidate): candidate is string => Boolean(candidate))

  for (const candidate of candidates) {
    try {
      return normalizeScorePayload(JSON.parse(candidate))
    } catch {
      // Try the next extraction strategy before returning a structured error.
    }
  }

  return invalidScore("AI score response was not valid JSON")
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

function buildScoringPrompt(candidate: AiNewsCandidateInput) {
  return [
    "Evaluate this AI/news candidate for a Chinese AI daily briefing.",
    "Return strict JSON only with fields: score/reason/summary/tags/riskFlags.",
    "Write reason and summary in Simplified Chinese. The summary must be one concise Chinese sentence.",
    "If the candidate text is English, translate the editorial reason and summary into natural Simplified Chinese while preserving product, company, model, and repository names.",
    "score must be 0-10. riskFlags may include hallucination, duplicate, low-signal when applicable.",
    "",
    `Title: ${candidate.title}`,
    `URL: ${candidate.canonicalUrl || candidate.url}`,
    `Source: ${candidate.sourceName} (${candidate.sourceType})`,
    `Published at: ${candidate.publishedAt?.toISOString() ?? "unknown"}`,
    `Summary: ${candidate.summary ?? ""}`,
    `Content: ${candidate.content ?? ""}`,
  ].join("\n")
}

export async function scoreAiNewsCandidate({
  candidate,
  aiModel,
  fetchImpl = fetch,
}: ScoreAiNewsCandidateInput): Promise<AiNewsScoreResult> {
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
            content: "You score AI news candidates for editorial relevance and reliability. Return strict JSON only.",
          },
          {
            role: "user",
            content: buildScoringPrompt(candidate),
          },
        ],
        temperature: 0.2,
      }),
    })

    const payload = await response.json().catch(() => null) as OpenAICompatibleChatPayload | null
    const upstreamError = payload?.error?.message

    if (!response.ok) {
      return invalidScore(upstreamError || `AI score request failed with HTTP ${response.status}`)
    }

    if (!payload) {
      return invalidScore("AI score response body was not valid JSON")
    }

    const assistantText = extractAssistantText(payload)
    if (!assistantText) {
      return invalidScore("AI score response did not include assistant content")
    }

    return parseAiNewsScoreResponse(assistantText)
  } catch (error) {
    return invalidScore(error instanceof Error ? error.message : "AI score request failed")
  }
}

function getEffectiveScore(candidate: AiNewsScoredCandidate) {
  const flags = new Set(candidate.aiRiskFlags.map((flag) => flag.toLowerCase()))
  const excluded = Array.from(EXCLUSION_RISK_FLAGS).some((flag) => flags.has(flag))
  const penalty = Array.from(DOWNRANK_RISK_FLAGS).some((flag) => flags.has(flag)) ? 2 : 0

  return {
    excluded,
    score: Math.max(0, candidate.aiScore - penalty),
  }
}

function getPerSourceLimit(maxSelected: number, sourceDiversity: SelectScoredCandidatesInput["sourceDiversity"]) {
  if (sourceDiversity === false) {
    return Number.POSITIVE_INFINITY
  }

  if (sourceDiversity?.maxPerSourceType) {
    return Math.max(1, sourceDiversity.maxPerSourceType)
  }

  const maxShare = sourceDiversity?.maxShare ?? 0.5
  return Math.max(1, Math.ceil(maxSelected * maxShare))
}

function rejectCandidate(candidate: AiNewsScoredCandidate, selectionReason: string): AiNewsScoredCandidate {
  return {
    ...candidate,
    selected: false,
    selectionReason,
  }
}

function selectCandidate(candidate: AiNewsScoredCandidate, selectionReason: string): AiNewsScoredCandidate {
  return {
    ...candidate,
    selected: true,
    selectionReason,
  }
}

export function selectScoredCandidates({
  candidates,
  threshold = 7,
  maxSelected = 12,
  sourceDiversity,
}: SelectScoredCandidatesInput): AiNewsSelectionResult {
  const perSourceLimit = getPerSourceLimit(maxSelected, sourceDiversity)
  const selected: AiNewsScoredCandidate[] = []
  const rejected: AiNewsScoredCandidate[] = []
  const sourceCounts = new Map<AiNewsSourceType, number>()
  const ranked = candidates
    .map((candidate, index) => ({
      candidate,
      index,
      effective: getEffectiveScore(candidate),
    }))
    .sort((left, right) => {
      if (right.effective.score !== left.effective.score) {
        return right.effective.score - left.effective.score
      }

      return left.index - right.index
    })

  for (const item of ranked) {
    const { candidate, effective } = item

    if (effective.excluded) {
      rejected.push(rejectCandidate(candidate, "Excluded by risk flags"))
      continue
    }

    if (!Number.isFinite(candidate.aiScore) || effective.score < threshold) {
      rejected.push(rejectCandidate(candidate, `Below selection threshold ${threshold}`))
      continue
    }

    if (selected.length >= maxSelected) {
      rejected.push(rejectCandidate(candidate, `Selection limit ${maxSelected} reached`))
      continue
    }

    const sourceCount = sourceCounts.get(candidate.sourceType) ?? 0
    if (sourceCount >= perSourceLimit) {
      rejected.push(rejectCandidate(candidate, `Source diversity limit reached for ${candidate.sourceType}`))
      continue
    }

    selected.push(selectCandidate(
      candidate,
      effective.score === candidate.aiScore ? "Selected by score" : `Selected after risk penalty, effective score ${effective.score}`,
    ))
    sourceCounts.set(candidate.sourceType, sourceCount + 1)
  }

  return {
    selected,
    rejected,
    threshold,
    maxSelected,
    qualityScore: selected.length
      ? selected.reduce((total, candidate) => total + candidate.aiScore, 0) / selected.length
      : 0,
    citationCoverage: selected.length
      ? selected.filter((candidate) => Boolean(candidate.canonicalUrl || candidate.url)).length / selected.length
      : 0,
  }
}
