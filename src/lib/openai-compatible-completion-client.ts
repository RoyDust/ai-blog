import {
  COMPLETION_SUCCESS_MAX_BYTES,
  DEFAULT_COMPLETION_PROBE_BUDGET_MS,
  DEFAULT_INTERACTIVE_COMPLETION_BUDGET_MS,
  DEFAULT_LONG_COMPLETION_BUDGET_MS,
  ReliabilityError,
  UPSTREAM_ERROR_MAX_BYTES,
  classifyHttpFailure,
  getResponseHeader,
  normalizeTransportError,
  parseRetryAfter,
  parseUpstreamDiagnostic,
  readResponseBodyBounded,
  withReliabilityRetry,
} from './external-reliability'

// Re-export the boundary error for callers that only need the completion
// client surface.  The implementation still lives in the lower-level module.
export { ReliabilityError } from './external-reliability'

export interface OpenAICompatibleTextPart {
  type?: string
  text?: string
  [key: string]: unknown
}

export interface OpenAICompatibleChatMessage {
  role: string
  content: string | readonly OpenAICompatibleTextPart[]
  [key: string]: unknown
}

export interface OpenAICompatibleModelConfig {
  /** Provider base URL, for example https://api.example.test/v1. */
  baseUrl: string
  /** Defaults to /chat/completions. */
  requestPath?: string
  model: string
  apiKey: string
  /** Provider-specific headers. Authorization is always supplied by apiKey. */
  headers?: Record<string, string>
  /** Provider-specific JSON fields, kept outside the transport protocol. */
  bodyExtensions?: Record<string, unknown>
}

export type CompletionBudgetStrategy = 'model-probe' | 'interactive-completion' | 'long-completion'

export interface CompletionRequestOptions {
  strategy?: CompletionBudgetStrategy
  /** Override the logical budget for this call. */
  budgetMs?: number
  /** Override one attempt's deadline. */
  attemptTimeoutMs?: number
  /** Extra JSON fields such as temperature or response_format. */
  bodyExtensions?: Record<string, unknown>
  /** Abort the local operation. It is not persisted or retried. */
  signal?: AbortSignal
}

export interface CompletionTextResult {
  text: string
  model?: string
  finishReason?: string
}

export interface CompletionClient {
  completeText(
    messages: readonly OpenAICompatibleChatMessage[],
    options?: CompletionRequestOptions,
  ): Promise<CompletionTextResult>
  completeJson<T>(
    messages: readonly OpenAICompatibleChatMessage[],
    decoder: (value: unknown) => T,
    options?: CompletionRequestOptions,
  ): Promise<T>
}

export interface CompletionClientRuntimeOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  random?: () => number
  sleep?: (ms: number) => Promise<void>
}

/** Minimal model shape accepted by callers that already resolve model config. */
export type OpenAICompatibleModelLike = Pick<OpenAICompatibleModelConfig, 'baseUrl' | 'model'> & {
  /** Model-directory views may omit a key while they are shown as unavailable. */
  apiKey?: string
  requestPath?: string
  headers?: Record<string, string>
}

interface CompletionPayload {
  choices?: unknown
  model?: unknown
}

interface CompletionChoice {
  message?: unknown
  finish_reason?: unknown
  finishReason?: unknown
}

const DEFAULT_REQUEST_PATH = '/chat/completions'
const RESERVED_PROVIDER_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization'])

/**
 * A narrow OpenAI-compatible Chat Completions transport.  Model selection,
 * prompts, domain decoding and fallback policy stay in the caller.
 */
export class OpenAICompatibleCompletionClient implements CompletionClient {
  private readonly config: OpenAICompatibleModelConfig
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly random: () => number
  private readonly sleep: (ms: number) => Promise<void>

  constructor(config: OpenAICompatibleModelConfig, runtime: CompletionClientRuntimeOptions = {}) {
    validateConfig(config)
    this.config = {
      ...config,
      requestPath: config.requestPath ?? DEFAULT_REQUEST_PATH,
    }
    this.fetchImpl = runtime.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.now = runtime.now ?? Date.now
    this.random = runtime.random ?? Math.random
    this.sleep = runtime.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  }

  async completeText(
    messages: readonly OpenAICompatibleChatMessage[],
    options: CompletionRequestOptions = {},
  ): Promise<CompletionTextResult> {
    validateMessages(messages)
    const policy = resolveCompletionPolicy(options)
    const body = {
      ...(this.config.bodyExtensions ?? {}),
      ...(options.bodyExtensions ?? {}),
      model: this.config.model,
      messages,
    }
    let serializedBody: string
    try {
      const serialized = JSON.stringify(body)
      if (typeof serialized !== 'string') {
        throw new TypeError('Completion request body did not serialize to JSON')
      }
      serializedBody = serialized
    } catch {
      throw new ReliabilityError({
        kind: 'configuration',
        retryable: false,
        message: 'Completion request body is not serializable',
        secrets: [this.config.apiKey],
      })
    }
    const endpoint = buildEndpoint(this.config.baseUrl, this.config.requestPath ?? DEFAULT_REQUEST_PATH)
    const secrets = [this.config.apiKey]

    return withReliabilityRetry(
      async ({ signal }) => {
        let response: Response
        try {
          response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              ...stripReservedHeaders(this.config.headers),
              'content-type': 'application/json',
              accept: 'application/json',
              authorization: `Bearer ${this.config.apiKey}`,
            },
            body: serializedBody,
            signal,
          })
        } catch (error) {
          throw normalizeTransportError(error, { secrets })
        }

        if (!isResponseLike(response)) {
          throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion transport returned an invalid response', secrets })
        }

        if (!response.ok) {
          throw await responseError(response, secrets, this.now)
        }

        let raw: string
        try {
          raw = await readResponseBodyBounded(response, { maxBytes: COMPLETION_SUCCESS_MAX_BYTES, secrets })
        } catch (error) {
          if (error instanceof ReliabilityError) throw error
          throw normalizeTransportError(error, { secrets })
        }
        let payload: CompletionPayload
        try {
          payload = JSON.parse(raw) as CompletionPayload
        } catch (error) {
          throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion response was not valid JSON', cause: error, secrets })
        }
        return parseCompletionPayload(payload, secrets)
      },
      {
        maxAttempts: policy.maxAttempts,
        totalTimeoutMs: policy.budgetMs,
        attemptTimeoutMs: options.attemptTimeoutMs,
        retryOnTimeout: false,
        now: this.now,
        random: this.random,
        sleep: this.sleep,
        signal: options.signal,
      },
    )
  }

  async completeJson<T>(
    messages: readonly OpenAICompatibleChatMessage[],
    decoder: (value: unknown) => T,
    options: CompletionRequestOptions = {},
  ): Promise<T> {
    if (typeof decoder !== 'function') {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion JSON decoder is invalid' })
    }
    const result = await this.completeText(messages, options)
    const jsonText = extractJsonText(result.text)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch (error) {
      throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion response did not contain valid JSON', cause: error, secrets: [this.config.apiKey] })
    }
    try {
      return decoder(parsed)
    } catch (error) {
      throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion JSON failed domain validation', cause: error, secrets: [this.config.apiKey] })
    }
  }
}

export function createOpenAICompatibleCompletionClient(
  config: OpenAICompatibleModelConfig,
  runtime?: CompletionClientRuntimeOptions,
): OpenAICompatibleCompletionClient {
  return new OpenAICompatibleCompletionClient(config, runtime)
}

/**
 * Adapt the model-directory shape without making the transport depend on the
 * model directory itself.  Missing credentials fail before any request is
 * scheduled, which also keeps them out of the retry loop.
 */
export function createCompletionClientForModel(
  model: OpenAICompatibleModelLike,
  runtime?: CompletionClientRuntimeOptions,
): OpenAICompatibleCompletionClient {
  if (!model || typeof model.apiKey !== 'string' || model.apiKey.length === 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion API key is missing' })
  }
  return createOpenAICompatibleCompletionClient({
    baseUrl: model.baseUrl,
    requestPath: model.requestPath,
    model: model.model,
    apiKey: model.apiKey,
    headers: model.headers,
  }, runtime)
}

function validateConfig(config: OpenAICompatibleModelConfig): void {
  if (!config || typeof config !== 'object') {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion model configuration is invalid' })
  }
  if (typeof config.baseUrl !== 'string' || config.baseUrl.trim().length === 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion base URL is missing' })
  }
  let url: URL
  try {
    url = new URL(config.baseUrl)
  } catch {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion base URL is invalid' })
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion base URL must be an HTTP(S) URL without credentials' })
  }
  if (typeof config.model !== 'string' || config.model.trim().length === 0 || config.model.length > 256) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion model is invalid' })
  }
  if (typeof config.apiKey !== 'string' || config.apiKey.length === 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion API key is missing' })
  }
  if (config.requestPath !== undefined && (typeof config.requestPath !== 'string' || config.requestPath.trim().length === 0)) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion request path is invalid' })
  }
  if (config.requestPath !== undefined) {
    try {
      if (/^[a-z][a-z\d+.-]*:/i.test(config.requestPath) || config.requestPath.startsWith('//')) {
        throw new Error('absolute request path')
      }
      const parsedPath = new URL(config.requestPath, 'https://completion.invalid')
      if (parsedPath.origin !== 'https://completion.invalid' || parsedPath.username || parsedPath.password || parsedPath.hash) {
        throw new Error('absolute or credentialed path')
      }
    } catch {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion request path is invalid' })
    }
  }
}

function validateMessages(messages: readonly OpenAICompatibleChatMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion messages are invalid' })
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object' || typeof message.role !== 'string' || message.role.length === 0) {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion message is invalid' })
    }
    if (typeof message.content !== 'string' && !Array.isArray(message.content)) {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion message content is invalid' })
    }
  }
}

function resolveCompletionPolicy(options: CompletionRequestOptions): { budgetMs: number; maxAttempts: number } {
  const strategy = options.strategy ?? 'interactive-completion'
  const defaultBudget = strategy === 'model-probe'
    ? DEFAULT_COMPLETION_PROBE_BUDGET_MS
    : strategy === 'long-completion'
      ? DEFAULT_LONG_COMPLETION_BUDGET_MS
      : DEFAULT_INTERACTIVE_COMPLETION_BUDGET_MS
  const budgetMs = options.budgetMs ?? defaultBudget
  if (!Number.isFinite(budgetMs) || budgetMs <= 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Completion budget is invalid' })
  }
  return { budgetMs: Math.floor(budgetMs), maxAttempts: strategy === 'model-probe' ? 1 : 2 }
}

function buildEndpoint(baseUrl: string, requestPath: string): string {
  const base = new URL(baseUrl)
  const normalizedBasePath = base.pathname.replace(/\/+$/, '')
  const request = new URL(requestPath.startsWith('/') ? requestPath : `/${requestPath}`, 'https://placeholder.invalid')
  const normalizedRequestPath = request.pathname.replace(/\/+$/, '') || '/'
  const endpointPath = normalizedBasePath.endsWith(normalizedRequestPath)
    ? normalizedBasePath || '/'
    : `${normalizedBasePath}${normalizedRequestPath}` || '/'
  const endpoint = new URL(base.origin)
  endpoint.pathname = endpointPath
  endpoint.search = request.search
  return endpoint.toString()
}

async function responseError(response: Response, secrets: readonly string[], now: () => number): Promise<ReliabilityError> {
  let body = ''
  try {
    body = await readResponseBodyBounded(response, { maxBytes: UPSTREAM_ERROR_MAX_BYTES, secrets })
  } catch {
    // Error diagnostics are best effort; status classification remains useful.
  }
  const diagnostic = parseUpstreamDiagnostic(body, { secrets })
  // Upstream messages are untrusted and can echo prompts or request bodies.
  // Keep the public transport error generic; code/status/request id are the
  // only bounded diagnostics safe to pass across the business boundary.
  return classifyHttpFailure(response.status, {
    message: undefined,
    upstreamCode: diagnostic.code,
    requestId: diagnostic.requestId ?? getResponseHeader(response, 'x-request-id') ?? getResponseHeader(response, 'request-id') ?? undefined,
    retryAfterMs: parseRetryAfter(getResponseHeader(response, 'retry-after'), now()),
    secrets,
  })
}

function isResponseLike(value: unknown): value is Response {
  return Boolean(value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean')
}

function parseCompletionPayload(payload: CompletionPayload, secrets: readonly string[]): CompletionTextResult {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.choices) || payload.choices.length === 0) {
    throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion response contained no choices', secrets })
  }
  const choice = payload.choices[0] as CompletionChoice | null
  const message = choice && typeof choice === 'object' && choice.message && typeof choice.message === 'object'
    ? choice.message as Record<string, unknown>
    : undefined
  const text = message ? extractMessageText(message.content) : undefined
  if (!text || text.trim().length === 0) {
    throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion response contained empty content', secrets })
  }
  const result: CompletionTextResult = { text: text.trim() }
  if (typeof payload.model === 'string' && payload.model.length <= 256) {
    result.model = payload.model
  }
  const finishReason = choice && typeof choice === 'object' ? choice.finish_reason ?? choice.finishReason : undefined
  if (typeof finishReason === 'string' && finishReason.length <= 64) {
    result.finishReason = finishReason
  }
  return result
}

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return undefined
  const parts: string[] = []
  for (const part of content) {
    if (!part || typeof part !== 'object') continue
    const typed = part as Record<string, unknown>
    if ((typed.type === 'text' || typed.type === 'output_text' || typed.type === undefined) && typeof typed.text === 'string') {
      parts.push(typed.text)
    }
  }
  return parts.length > 0 ? parts.join('') : undefined
}

/**
 * Compatibility decoder for callers that need to inspect a recorded protocol
 * payload.  New network callers should use completeText so response limits and
 * error classification are applied before decoding.
 */
export function extractCompletionPayloadText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices) || choices.length === 0) return ''
  const first = choices[0]
  if (!first || typeof first !== 'object') return ''
  const message = (first as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  return extractMessageText((message as { content?: unknown }).content)?.trim() ?? ''
}

/** Extract pure, fenced, or first balanced JSON from model prose. */
export function extractJsonText(text: string): string {
  const trimmed = text.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const candidate = (fence?.[1] ?? trimmed).trim()
  try {
    JSON.parse(candidate)
    return candidate
  } catch {
    // Continue with balanced extraction below.
  }
  const balanced = findBalancedJsonCandidates(candidate)
  for (const value of balanced) {
    try {
      JSON.parse(value)
      return value
    } catch {
      // A balanced fragment may still be invalid JSON; try the next fragment.
    }
  }
  throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'Completion response did not contain a JSON object or array' })
}

export function findBalancedJsonCandidates(text: string): string[] {
  const candidates: string[] = []
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{' && text[start] !== '[') continue
    const stack: string[] = []
    let inString = false
    let escaped = false
    for (let index = start; index < text.length; index += 1) {
      const char = text[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }
      if (char === '"') {
        inString = true
        continue
      }
      if (char === '{' || char === '[') stack.push(char)
      else if (char === '}' || char === ']') {
        const expected = char === '}' ? '{' : '['
        if (stack[stack.length - 1] !== expected) break
        stack.pop()
        if (stack.length === 0) {
          candidates.push(text.slice(start, index + 1))
          break
        }
      }
    }
  }
  return candidates
}

function stripReservedHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers ?? {}).filter(([name]) => !RESERVED_PROVIDER_HEADERS.has(name.toLowerCase())),
  )
}
