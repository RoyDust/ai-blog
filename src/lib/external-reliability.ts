/**
 * Small, framework-free reliability primitives for outbound HTTP calls.
 *
 * This module intentionally has no dependency on Next, Prisma, model
 * configuration, or a business workflow.  Callers decide what a failed
 * request means to their domain; this module only describes transport facts.
 */

export const COMPLETION_SUCCESS_MAX_BYTES = 2 * 1024 * 1024
export const EXTERNAL_CONTENT_SUCCESS_MAX_BYTES = 5 * 1024 * 1024
export const UPSTREAM_ERROR_MAX_BYTES = 64 * 1024
export const DEFAULT_RETRY_BASE_DELAY_MS = 250
export const DEFAULT_RETRY_MAX_DELAY_MS = 2_000
export const DEFAULT_RETRY_AFTER_MAX_DELAY_MS = 5_000
export const DEFAULT_COMPLETION_PROBE_BUDGET_MS = 15_000
export const DEFAULT_INTERACTIVE_COMPLETION_BUDGET_MS = 30_000
export const DEFAULT_LONG_COMPLETION_BUDGET_MS = 120_000
export const DEFAULT_EXTERNAL_CONTENT_BUDGET_MS = 30_000
export const DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS = 12_000

export const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504])

export const RELIABILITY_ERROR_KINDS = [
  'configuration',
  'timeout',
  'rate-limited',
  'transient-upstream',
  'upstream-rejected',
  'network',
  'invalid-response',
  'response-too-large',
] as const

export type ReliabilityErrorKind = (typeof RELIABILITY_ERROR_KINDS)[number]

export interface ReliabilityErrorOptions {
  kind: ReliabilityErrorKind
  retryable: boolean
  status?: number
  upstreamCode?: string | number
  requestId?: string
  message?: string
  cause?: unknown
  /** Internal retry metadata. It is deliberately not part of diagnostics. */
  retryAfterMs?: number
  secrets?: readonly string[]
}

/**
 * Error used at the transport boundary. Only finite, scrubbed fields are
 * retained so callers can safely log kind/status without echoing an upstream
 * body, URL credentials, prompt, or API key. The original cause is
 * intentionally not retained: fetch/driver errors can carry request details.
 */
export class ReliabilityError extends Error {
  readonly kind: ReliabilityErrorKind
  readonly retryable: boolean
  readonly status?: number
  readonly upstreamCode?: string
  readonly requestId?: string
  readonly retryAfterMs?: number

  constructor(options: ReliabilityErrorOptions) {
    const message = scrubUpstreamDiagnostic(options.message ?? defaultMessage(options.kind), {
      secrets: options.secrets,
      maxLength: 256,
    })
    super(message)
    this.name = 'ReliabilityError'
    this.kind = options.kind
    this.retryable = options.retryable
    this.status = isFiniteHttpStatus(options.status) ? options.status : undefined
    this.upstreamCode = finiteUpstreamCode(options.upstreamCode, options.secrets)
    const requestId = finiteUpstreamCode(options.requestId, options.secrets)
    if (requestId) this.requestId = requestId
    this.retryAfterMs = finiteDelay(options.retryAfterMs)
  }
}

// A descriptive alias makes the boundary easier to discover without creating
// a second error implementation.
export { ReliabilityError as ExternalReliabilityError }

function defaultMessage(kind: ReliabilityErrorKind): string {
  switch (kind) {
    case 'configuration':
      return 'Outbound request configuration is invalid'
    case 'timeout':
      return 'Outbound request timed out'
    case 'rate-limited':
      return 'Upstream rate limit reached'
    case 'transient-upstream':
      return 'Upstream service temporarily unavailable'
    case 'upstream-rejected':
      return 'Upstream rejected the request'
    case 'network':
      return 'Network request failed'
    case 'invalid-response':
      return 'Upstream response was invalid'
    case 'response-too-large':
      return 'Upstream response exceeded the size limit'
  }
}

function finiteDelay(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined
  }
  return Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER)
}

function isFiniteHttpStatus(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599
}

function finiteUpstreamCode(value: unknown, secrets?: readonly string[]): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return undefined
  }
  const text = scrubUpstreamDiagnostic(String(value), { secrets, maxLength: 64 }).trim()
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : undefined
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Remove credentials and bound untrusted diagnostic text.  This is value
 * level scrubbing; structured log key filtering remains the responsibility of
 * the existing operation-log layer.
 */
export function scrubUpstreamDiagnostic(
  value: unknown,
  options: { secrets?: readonly string[]; maxLength?: number; url?: boolean } = {},
): string {
  const maxLength = Number.isFinite(options.maxLength) && (options.maxLength ?? 0) > 0
    ? Math.floor(options.maxLength as number)
    : 256
  let text = typeof value === 'string' ? value : value instanceof Error ? value.message : String(value ?? '')

  if (options.url || looksLikeUrl(text)) {
    const safeUrl = scrubUrlDiagnostic(text)
    if (safeUrl !== undefined) {
      text = safeUrl
    }
  }

  // Upstream errors often embed a URL in a sentence rather than returning a
  // URL as the whole diagnostic.  Scrub each embedded URL before applying the
  // token/header patterns so credentials and signed query values cannot leak
  // through that form.
  text = text.replace(/https?:\/\/[^\s<>"']+/gi, (candidate) => {
    const trailing = candidate.match(/[),.;:!?]+$/)?.[0] ?? ''
    const rawUrl = trailing ? candidate.slice(0, -trailing.length) : candidate
    return `${scrubUrlDiagnostic(rawUrl) ?? 'https://[redacted]'}${trailing}`
  })

  for (const secret of options.secrets ?? []) {
    if (typeof secret === 'string' && secret.length > 0) {
      text = text.replace(new RegExp(escapeRegExp(secret), 'g'), '[redacted]')
    }
  }

  text = text
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/(authorization\s*[:=]\s*)(?!bearer\s+)[^\s,;]+/gi, '$1[redacted]')
    .replace(/([?&](?:api[_-]?key|access[_-]?token|auth(?:orization)?|credential|key|password|secret|signature|sig|token|private[_-]?key)=)[^&#\s]+/gi, '$1[redacted]')
    .replace(/(x-api-key\s*[:=]\s*)([^\s,;]+)/gi, '$1[redacted]')

  if (text.length <= maxLength) {
    return text
  }
  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim())
}

/** Keep only origin/path for URL diagnostics, dropping credentials and query. */
export function scrubUrlDiagnostic(value: string): string | undefined {
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `${url.protocol}//[redacted]`
    }
    return `${url.origin}${url.pathname || '/'}${url.hash ? '#[redacted]' : ''}`
  } catch {
    return undefined
  }
}

export interface ParsedUpstreamDiagnostic {
  code?: string
  message?: string
  requestId?: string
}

/** Parse only a tiny whitelist from an upstream error body. */
export function parseUpstreamDiagnostic(
  body: string,
  options: { secrets?: readonly string[] } = {},
): ParsedUpstreamDiagnostic {
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    const root = parsed as Record<string, unknown>
    const nested = root.error && typeof root.error === 'object' ? root.error as Record<string, unknown> : undefined
    const rawCode = nested?.code ?? root.code ?? root.error_code ?? root.errorCode
    const rawMessage = nested?.message ?? root.message ?? root.error_message ?? root.errorMessage
    const rawRequestId = root.request_id ?? root.requestId ?? root.requestID
    const result: ParsedUpstreamDiagnostic = {}
    const code = finiteUpstreamCode(rawCode, options.secrets)
    const message = typeof rawMessage === 'string'
      ? scrubUpstreamDiagnostic(rawMessage, { secrets: options.secrets, maxLength: 192 })
      : undefined
    const requestId = typeof rawRequestId === 'string'
      ? scrubUpstreamDiagnostic(rawRequestId, { secrets: options.secrets, maxLength: 96 })
      : undefined
    if (code) result.code = code
    if (message) result.message = message
    if (requestId) result.requestId = requestId
    return result
  } catch {
    return {}
  }
}

export function isRetryableHttpStatus(status: number): boolean {
  return RETRYABLE_HTTP_STATUSES.has(status)
}

export function classifyHttpFailure(
  status: number,
  options: {
    message?: string
    upstreamCode?: string | number
    requestId?: string
    retryAfterMs?: number
    secrets?: readonly string[]
  } = {},
): ReliabilityError {
  const kind: ReliabilityErrorKind = status === 429
    ? 'rate-limited'
    : isRetryableHttpStatus(status)
      ? 'transient-upstream'
      : 'upstream-rejected'
  return new ReliabilityError({
    kind,
    retryable: isRetryableHttpStatus(status),
    status,
    upstreamCode: options.upstreamCode,
    requestId: options.requestId,
    retryAfterMs: options.retryAfterMs,
    message: options.message,
    secrets: options.secrets,
  })
}

export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const seconds = Number(trimmed)
    return Number.isFinite(seconds) ? Math.max(0, Math.min(DEFAULT_RETRY_AFTER_MAX_DELAY_MS, Math.floor(seconds * 1000))) : undefined
  }
  const date = Date.parse(trimmed)
  if (!Number.isFinite(date)) return undefined
  return Math.max(0, Math.min(DEFAULT_RETRY_AFTER_MAX_DELAY_MS, date - now))
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError' || error.name === 'TimeoutError'
    : !!error && typeof error === 'object' && ((error as { name?: unknown }).name === 'AbortError' || (error as { name?: unknown }).name === 'TimeoutError')
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return false
  if (error instanceof ReliabilityError) return error.kind === 'network' && error.retryable
  if (hasNonRetryableNetworkCause(error)) return false
  if (error instanceof TypeError) return true
  if (error && typeof error === 'object') {
    const code = String((error as { code?: unknown }).code ?? '').toUpperCase()
    return ['ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'EPIPE'].includes(code)
  }
  return false
}

export function normalizeTransportError(error: unknown, options: { timedOut?: boolean; secrets?: readonly string[] } = {}): ReliabilityError {
  if (error instanceof ReliabilityError) return error
  if (options.timedOut || isAbortError(error)) {
    return new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out', cause: error, secrets: options.secrets })
  }
  const retryable = isRetryableNetworkError(error)
  return new ReliabilityError({
    kind: 'network',
    retryable,
    message: scrubUpstreamDiagnostic(error instanceof Error ? error.message : 'Network request failed', { secrets: options.secrets }),
    cause: error,
    secrets: options.secrets,
  })
}

function hasNonRetryableNetworkCause(error: unknown): boolean {
  let current: unknown = error
  for (let depth = 0; depth < 3 && current; depth += 1) {
    if (typeof current === 'object') {
      const code = String((current as { code?: unknown }).code ?? '').toUpperCase()
      if (
        code === 'CERT_HAS_EXPIRED' ||
        code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        code === 'ERR_INVALID_URL' ||
        code === 'ERR_INVALID_PROTOCOL' ||
        code === 'ERR_INVALID_ARG_TYPE'
      ) {
        return true
      }
    }
    const message = current instanceof Error ? current.message : String(current)
    if (/\b(?:certificate|tls|ssl|invalid\s+(?:url|protocol)|unsupported\s+protocol)\b/i.test(message)) {
      return true
    }
    current = typeof current === 'object' ? (current as { cause?: unknown }).cause : undefined
  }
  return false
}

export interface BoundedReadOptions {
  maxBytes: number
  secrets?: readonly string[]
}

/**
 * Read a response as bytes while enforcing both Content-Length and the actual
 * stream size.  Keeping the byte primitive separate lets image callers apply
 * the same limit without first materialising an unbounded string.
 */
export async function readResponseBytesBounded(
  response: Response,
  options: BoundedReadOptions | number,
): Promise<Uint8Array> {
  const maxBytes = typeof options === 'number' ? options : options.maxBytes
  const secrets = typeof options === 'number' ? undefined : options.secrets
  if (!Number.isFinite(maxBytes) || maxBytes < 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Response size limit is invalid', secrets })
  }

  const contentLength = getResponseHeader(response, 'content-length')
  if (contentLength !== null) {
    const parsed = Number(contentLength)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed > maxBytes) {
      await cancelResponseBody(response)
      throw new ReliabilityError({ kind: 'response-too-large', retryable: false, status: response.status, message: 'Upstream response exceeded the size limit', secrets })
    }
  }

  if (!response.body) {
    try {
      // Real Fetch responses expose text(); a few lightweight test/runtime
      // adapters expose only json().  Supporting both keeps the boundary
      // bounded without making callers know which adapter supplied it.
      let text: string
      if (typeof response.text === 'function') {
        text = await response.text()
      } else if (typeof response.json === 'function') {
        const value = await response.json()
        const serialized = JSON.stringify(value)
        text = typeof serialized === 'string' ? serialized : ''
      } else {
        throw new TypeError('Response body reader is unavailable')
      }
      const bytes = new TextEncoder().encode(text)
      if (bytes.byteLength > maxBytes) {
        throw new ReliabilityError({ kind: 'response-too-large', retryable: false, status: response.status, message: 'Upstream response exceeded the size limit', secrets })
      }
      return bytes
    } catch (error) {
      if (error instanceof ReliabilityError) throw error
      throw normalizeTransportError(error, { secrets })
    }
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      const chunk = next.value instanceof Uint8Array ? next.value : new Uint8Array(next.value)
      total += chunk.byteLength
      if (total > maxBytes) {
        try { await reader.cancel('response-too-large') } catch { /* best effort */ }
        throw new ReliabilityError({ kind: 'response-too-large', retryable: false, status: response.status, message: 'Upstream response exceeded the size limit', secrets })
      }
      chunks.push(chunk)
    }
  } catch (error) {
    try { reader.releaseLock() } catch { /* best effort */ }
    if (error instanceof ReliabilityError) throw error
    throw normalizeTransportError(error, { secrets })
  } finally {
    try { reader.releaseLock() } catch { /* best effort */ }
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

/**
 * Read a response as UTF-8 while enforcing both Content-Length and actual
 * stream byte limits.  A reader is cancelled as soon as the limit is crossed.
 */
export async function readResponseBodyBounded(response: Response, options: BoundedReadOptions | number): Promise<string> {
  const optionsObject = typeof options === 'number' ? { maxBytes: options } : options
  const bytes = await readResponseBytesBounded(response, optionsObject)
  return new TextDecoder().decode(bytes)
}

/** Read a header from real Responses and minimal response doubles alike. */
export function getResponseHeader(response: Response, name: string): string | null {
  const headers = response?.headers as Headers | undefined
  if (headers && typeof headers.get === 'function') {
    return headers.get(name)
  }
  return null
}

export async function cancelResponseBody(response: Response): Promise<void> {
  try {
    if (response.body) {
      await response.body.cancel()
    }
  } catch {
    // Cancellation is a resource hint; the size error remains authoritative.
  }
}

export interface DeadlineOptions {
  timeoutMs: number
  signal?: AbortSignal
}

/** Run one operation with a local deadline and an AbortSignal. */
export async function withLocalDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: DeadlineOptions,
): Promise<T> {
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs <= 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Request deadline is invalid' })
  }
  const controller = new AbortController()
  let timedOut = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const onAbort = () => controller.abort(options.signal?.reason)
  if (options.signal) {
    if (options.signal.aborted) {
      throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request was aborted' })
    }
    options.signal.addEventListener('abort', onAbort, { once: true })
  }
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      reject(new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out' }))
    }, options.timeoutMs)
  })
  try {
    return await Promise.race([operation(controller.signal), timeout])
  } catch (error) {
    if (timedOut) {
      throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out', cause: error })
    }
    if (error instanceof ReliabilityError) throw error
    if (options.signal?.aborted) {
      throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request was aborted', cause: error })
    }
    throw normalizeTransportError(error)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
    options.signal?.removeEventListener('abort', onAbort)
  }
}

export interface RetryOperationContext {
  attempt: number
  signal: AbortSignal
  remainingMs: number
}

export interface RetryOptions {
  maxAttempts: number
  totalTimeoutMs: number
  attemptTimeoutMs?: number
  retryOnTimeout?: boolean
  baseDelayMs?: number
  maxDelayMs?: number
  sleep?: (ms: number) => Promise<void>
  random?: () => number
  now?: () => number
  signal?: AbortSignal
}

/**
 * Execute a finite retry loop in the current Promise chain.  No state or
 * scheduler is created; callers can inject clock/random/sleep in tests.
 */
export async function withReliabilityRetry<T>(
  operation: (context: RetryOperationContext) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Retry attempt limit is invalid' })
  }
  const maxAttempts = options.maxAttempts
  const totalTimeoutMs = Math.floor(options.totalTimeoutMs)
  if (!Number.isFinite(totalTimeoutMs) || totalTimeoutMs <= 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Retry budget is invalid' })
  }
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS
  const maxDelayMs = options.maxDelayMs ?? DEFAULT_RETRY_MAX_DELAY_MS
  if (!Number.isFinite(baseDelayMs) || baseDelayMs < 0 || !Number.isFinite(maxDelayMs) || maxDelayMs < 0) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'Retry delay policy is invalid' })
  }
  const now = options.now ?? Date.now
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const random = options.random ?? Math.random
  const startedAt = now()
  const deadline = startedAt + totalTimeoutMs
  let lastError: ReliabilityError | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request was aborted' })
    }
    const remainingBeforeAttempt = deadline - now()
    if (remainingBeforeAttempt <= 0) {
      throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out' })
    }
    const attemptTimeout = Math.max(1, Math.min(
      remainingBeforeAttempt,
      Number.isFinite(options.attemptTimeoutMs) && (options.attemptTimeoutMs ?? 0) > 0 ? Math.floor(options.attemptTimeoutMs as number) : remainingBeforeAttempt,
    ))

    try {
      const value = await runAttempt(operation, { attempt, attemptTimeout, remainingBeforeAttempt, signal: options.signal })
      return value
    } catch (rawError) {
      const error = rawError instanceof ReliabilityError
        ? rawError
        : normalizeTransportError(rawError)
      lastError = error
      const timeout = error.kind === 'timeout'
      const callerAborted = options.signal?.aborted === true
      const canRetry = attempt < maxAttempts
        && !callerAborted
        && (timeout ? options.retryOnTimeout === true : error.retryable)
      if (!canRetry) throw error

      const remaining = deadline - now()
      if (remaining <= 0) {
        throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out', cause: error })
      }
      const retryAfter = finiteDelay(error.retryAfterMs)
      const exponential = Math.min(maxDelayMs, baseDelayMs * (2 ** (attempt - 1)))
      const jitter = Math.max(0, Math.min(1, Number(random()) || 0))
      const requestedDelay = retryAfter !== undefined ? Math.min(DEFAULT_RETRY_AFTER_MAX_DELAY_MS, retryAfter) : Math.floor(exponential * jitter)
      const delay = Math.min(requestedDelay, remaining)
      if (delay >= remaining && remaining <= 1) {
        throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out', cause: error })
      }
      try {
        await sleep(delay)
      } catch (sleepError) {
        throw normalizeTransportError(sleepError)
      }
      if (deadline - now() <= 0) {
        throw new ReliabilityError({ kind: 'timeout', retryable: false, message: 'Outbound request timed out', cause: error })
      }
    }
  }
  throw lastError ?? new ReliabilityError({ kind: 'network', retryable: false, message: 'Network request failed' })
}

async function runAttempt<T>(
  operation: (context: RetryOperationContext) => Promise<T>,
  options: { attempt: number; attemptTimeout: number; remainingBeforeAttempt: number; signal?: AbortSignal },
): Promise<T> {
  return withLocalDeadline(
    (signal) => operation({ attempt: options.attempt, signal, remainingMs: options.remainingBeforeAttempt }),
    { timeoutMs: options.attemptTimeout, signal: options.signal },
  )
}
