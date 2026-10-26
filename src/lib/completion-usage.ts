export interface CompletionUsage {
  prompt_tokens: number | null
  completion_tokens: number | null
  total_tokens: number | null
  reasoning_tokens: number | null
  prompt_cache_hit_tokens: number | null
  prompt_cache_miss_tokens: number | null
}

export interface CompletionAttempt {
  callId: string
  attempt: number
  startedAt: string
  durationMs: number
  statusCode: number | null
  success: boolean
  model: string | null
  finishReason: string | null
  usage: CompletionUsage | null
  errorKind: string | null
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function count(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

/** Preserve unknown counters as null: absent usage is not zero-cost usage. */
export function extractCompletionUsage(payload: unknown): CompletionUsage | null {
  const usage = record(record(payload)?.usage)
  if (!usage) return null
  const details = record(usage.completion_tokens_details)
  const promptDetails = record(usage.prompt_tokens_details)
  return {
    prompt_tokens: count(usage.prompt_tokens),
    completion_tokens: count(usage.completion_tokens),
    total_tokens: count(usage.total_tokens),
    reasoning_tokens: count(details?.reasoning_tokens) ?? count(usage.reasoning_tokens),
    prompt_cache_hit_tokens: count(usage.prompt_cache_hit_tokens) ?? count(promptDetails?.cached_tokens),
    prompt_cache_miss_tokens: count(usage.prompt_cache_miss_tokens),
  }
}
