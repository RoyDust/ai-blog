import { randomUUID } from 'node:crypto'
import { createApiOperationLog } from '@/lib/api-operation-logs'
import { extractCompletionUsage, type CompletionAttempt } from '@/lib/completion-usage'
import { COMPLETION_SUCCESS_MAX_BYTES, isAbortError, readResponseBodyBounded } from '@/lib/external-reliability'
import {
  createOpenAICompatibleCompletionClient,
  ReliabilityError,
  type OpenAICompatibleModelLike,
  type CompletionClientRuntimeOptions,
} from '@/lib/openai-compatible-completion-client'
import { safeOutboundFetch, validateOutboundUrl, type SsrfGuardOptions } from '@/lib/ssrf-guard'

function safeProviderHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname
  } catch {
    return 'invalid'
  }
}

function buildSafeModelEndpointUrl(
  baseUrl: string,
  requestPath: string,
  options?: SsrfGuardOptions & { secrets?: readonly string[] },
): URL {
  const base = validateOutboundUrl(baseUrl, options)
  if (/^[a-z][a-z\d+.-]*:/i.test(requestPath) || requestPath.startsWith('//')) {
    throw new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: 'Completion request path is invalid',
      secrets: options?.secrets,
    })
  }
  const normalizedBasePath = base.pathname.replace(/\/+$/, '')
  const parsedPath = new URL(requestPath.startsWith('/') ? requestPath : `/${requestPath}`, 'https://completion.invalid')
  if (parsedPath.origin !== 'https://completion.invalid' || parsedPath.username || parsedPath.password || parsedPath.hash) {
    throw new ReliabilityError({
      kind: 'configuration',
      retryable: false,
      message: 'Completion request path is invalid',
      secrets: options?.secrets,
    })
  }
  const normalizedRequestPath = parsedPath.pathname.replace(/\/+$/, '') || '/'
  const endpointPath = normalizedBasePath.endsWith(normalizedRequestPath)
    ? normalizedBasePath || '/'
    : `${normalizedBasePath}${normalizedRequestPath}` || '/'
  const endpoint = new URL(base.origin)
  endpoint.pathname = endpointPath
  endpoint.search = parsedPath.search
  return validateOutboundUrl(endpoint, options)
}

/** Application boundary: leaf transports report attempts without importing Prisma. */
export function createAiUsageRecorder(model: OpenAICompatibleModelLike & { id?: string }, operation: string) {
  const providerHost = safeProviderHost(model.baseUrl)
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

/** Observe existing single-attempt JSON callers while enforcing SSRF and bounded response guards. */
export async function fetchAiModelJson(
  model: OpenAICompatibleModelLike & { id?: string },
  init: RequestInit,
  operation: string,
  fetchImpl?: typeof fetch,
  options?: SsrfGuardOptions,
) {
  const callId = randomUUID()
  const startedAt = Date.now()
  const record = createAiUsageRecorder(model, operation)
  const secrets = model.apiKey ? [model.apiKey] : []
  let response: Response | undefined
  let payload: unknown = null
  let errorKind: string | null = null
  try {
    const endpoint = buildSafeModelEndpointUrl(model.baseUrl, model.requestPath ?? '/chat/completions', {
      allowLoopback: options?.allowLoopback,
      secrets,
    })
    response = await safeOutboundFetch(endpoint, init, {
      fetchImpl,
      allowLoopback: options?.allowLoopback,
      secrets,
    })
    try {
      const raw = await readResponseBodyBounded(response, { maxBytes: COMPLETION_SUCCESS_MAX_BYTES, secrets })
      payload = JSON.parse(raw)
    } catch (readError) {
      if (readError instanceof ReliabilityError && readError.kind === 'response-too-large') {
        errorKind = readError.kind
        throw readError
      }
      errorKind = 'invalid-response'
    }
    return { response, payload }
  } catch (error) {
    if (error instanceof ReliabilityError) {
      errorKind = error.kind
    } else if (init.signal?.aborted || isAbortError(error)) {
      errorKind = 'timeout'
    } else {
      errorKind = 'network'
    }
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
