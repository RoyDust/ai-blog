export type AiNewsSourceType = "RSS" | "HACKERNEWS" | "GITHUB_RELEASES" | "GITHUB_TRENDING_RSS" | "REDDIT"

export type AiNewsJsonObject = Record<string, unknown>

export type AiNewsSourceConfig = {
  id: string
  type: AiNewsSourceType
  name: string
  url: string
  homepage?: string | null
  category?: string | null
  enabled?: boolean
  defaultEnabled?: boolean
  weight?: number
  minScore?: number | null
  fetchLimit?: number | null
  config?: AiNewsJsonObject | null
}

export type AiNewsSourceSnapshot = {
  id: string
  type: AiNewsSourceType
  name: string
  url: string
  homepage?: string | null
  category?: string | null
  enabled: boolean
  defaultEnabled?: boolean
  weight?: number
  minScore?: number | null
  fetchLimit?: number | null
}

export type AiNewsRawItem = {
  id: string
  sourceId?: string | null
  sourceType: AiNewsSourceType
  sourceName: string
  title: string
  url: string
  canonicalUrl?: string
  summary?: string | null
  content?: string | null
  author?: string | null
  publishedAt?: Date | null
  metadata?: AiNewsJsonObject | null
  community?: AiNewsJsonObject | null
}

export type AiNewsCandidateInput = AiNewsRawItem & {
  canonicalUrl: string
  duplicateOfId?: string | null
  mergedSources?: Array<{
    sourceId?: string | null
    sourceType: AiNewsSourceType
    sourceName: string
    url: string
  }>
  enrichment?: AiNewsJsonObject | null
}

export type AiNewsSourceFailure = {
  sourceId?: string | null
  sourceName?: string
  sourceType?: AiNewsSourceType
  url?: string
  stage: "load" | "fetch" | "parse" | "score" | "persist" | "select"
  message: string
}

export type AiNewsScoreResult = {
  score: number
  reason: string
  summary: string
  tags: string[]
  riskFlags: string[]
  error?: string
}

export type AiNewsScoredCandidate = AiNewsCandidateInput & {
  aiScore: number
  aiReason?: string | null
  aiSummary?: string | null
  aiTags: string[]
  aiRiskFlags: string[]
  scoreError?: string | null
  selected?: boolean
  selectionReason?: string | null
}

export type AiNewsSelectionResult = {
  selected: AiNewsScoredCandidate[]
  rejected: AiNewsScoredCandidate[]
  threshold: number
  maxSelected: number
  qualityScore?: number
  citationCoverage?: number
}

export type AiNewsFactCard = {
  title: string
  summary: string
  citations: Array<{
    title?: string
    url: string
    sourceName?: string
  }>
  confidence?: "low" | "medium" | "high"
}

export type AiNewsRunMetrics = {
  rawCandidateCount: number
  dedupedCandidateCount: number
  scoredCandidateCount: number
  selectedCandidateCount: number
  configuredSourceCount?: number
  sourceFailureJson?: AiNewsSourceFailure[]
  qualityScore?: number
  citationCoverage?: number
  generationMode?: "legacy" | "candidate-pipeline" | "fallback"
}
