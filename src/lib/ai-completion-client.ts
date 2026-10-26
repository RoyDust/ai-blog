import { randomUUID } from 'node:crypto'
import { createApiOperationLog } from '@/lib/api-operation-logs'
import { extractCompletionUsage, type CompletionAttempt } from '@/lib/completion-usage'
import {
  createOpenAICompatibleCompletionClient,
  ReliabilityError,
  type OpenAICompatibleModelLike,
  type CompletionClientRuntimeOptions,
} from '@/lib/openai-compatible-completion-client'

/** Application boundary: leaf transports report attempts without importing Prisma. */
export function createAiUsageRecorder(model: OpenAICompatibleModelLike & { id?: string }, operation: string) {
  const providerHost = new URL(model.baseUrl).hostname
  const requestPath = model.requestPath ?? '/chat/completions'
  return async (attempt: CompletionAttempt) => {
    await createApiOperationLog({
      requestId: randomUUID(),
      method: 'POST',
      path: '/outbound/ai/completions',
      scope: 'ai-usage',
      operation,
      statusCode: attempt.statusCode,
      errorKind: attempt.errorKind,
      success: attempt.success,
      durationMs: attempt.durationMs,
      actorType: 'system',
      metadata: {
        callId: attempt.callId,
        attempt: attempt.attempt,
        modelId: model.id ?? null,
        requestedModel: model.model,
        responseModel: attempt.model,
        providerHost,
        requestPath,
        usageReported: attempt.usage !== null,
        usage: attempt.usage ? { ...attempt.usage } : null,
      },
    })
  }
}

export function createCompletionClientForModel(
  model: OpenAICompatibleModelLike & { id?: string },
  runtime?: CompletionClientRuntimeOptions,
  operation = 'ai.completion',
) {
  if (!model || typeof model.apiKey !== 'string' || model.apiKey.length === 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion API key is missing' })
  }
  return createOpenAICompatibleCompletionClient({
    baseUrl: model.baseUrl,
    requestPath: model.requestPath,
    model: model.model,
    apiKey: model.apiKey,
    headers: model.headers,
    onAttempt: createAiUsageRecorder(model, operation),
  }, runtime)
}

/** Observe existing single-attempt JSON callers without changing their retry/timeout policy. */
export async function fetchAiModelJson(
  model: OpenAICompatibleModelLike & { id?: string },
  init: RequestInit,
  operation: string,
  fetchImpl: typeof fetch = fetch,
) {
  const callId = randomUUID()
  const startedAt = Date.now()
  const record = createAiUsageRecorder(model, operation)
  let response: Response | undefined
  let payload: unknown = null
  let errorKind: string | null = null
  try {
    response = await fetchImpl(`${model.baseUrl.replace(/\/+$/, '')}${model.requestPath ?? '/chat/completions'}`, init)
    try {
      payload = await response.json()
    } catch {
      errorKind = 'invalid-response'
    }
    return { response, payload }
  } catch (error) {
    errorKind = init.signal?.aborted ? 'timeout' : 'network'
    throw error
  } finally {
    const value = payload && typeof payload === 'object' ? payload as Record<string, unknown> : undefined
    const choice = Array.isArray(value?.choices) ? value.choices[0] : undefined
    await record({
      callId, attempt: 1, startedAt: new Date(startedAt).toISOString(),
      durationMs: Date.now() - startedAt,
      statusCode: response?.status ?? null,
      success: Boolean(response?.ok) && errorKind === null,
      model: typeof value?.model === 'string' ? value.model : null,
      finishReason: typeof choice?.finish_reason === 'string' ? choice.finish_reason : null,
      usage: extractCompletionUsage(payload),
      errorKind: errorKind ?? (response && !response.ok ? 'upstream-rejected' : null),
    }).catch(() => { console.error('Completion usage recording failed') })
  }
}
