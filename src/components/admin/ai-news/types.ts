export type AiNewsSourceType = "RSS" | "HACKERNEWS" | "GITHUB_RELEASES" | "GITHUB_TRENDING_RSS" | "REDDIT"

export type PublicAiNewsSource = {
  id: string
  type: AiNewsSourceType
  name: string
  url: string
  homepage: string | null
  category: string | null
  enabled: boolean
  weight: number
  minScore: number | null
  fetchLimit: number | null
  settings: Record<string, unknown>
  editable: boolean
  deletable: boolean
  lastTestedAt: string | Date | null
  lastTestStatus: "success" | "failed" | string | null
  lastTestMessage: string | null
  lastFetchedItemCount: number | null
  stats: {
    recentRunCount: number
    recentCandidateCount: number
    recentSelectedCount: number
    recentFailureCount: number
  }
  healthWarnings: string[]
  createdAt?: string | Date
  updatedAt?: string | Date
}

export type AiNewsSourceFormState = {
  id?: string
  type: AiNewsSourceType
  name: string
  url: string
  homepage: string
  category: string
  enabled: boolean
  weight: string
  minScore: string
  fetchLimit: string
  commentLimit: string
  commentTextMaxLength: string
}

export type AiNewsSourceTestResult = {
  status: "success" | "failed"
  itemCount: number
  sampleItems: Array<{ title: string; url: string }>
  message: string
  testedAt: string | Date
}

export type AiNewsSourcePagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type AiNewsSourceSummary = {
  enabledCount: number
  enabledSourceIds: string[]
}
