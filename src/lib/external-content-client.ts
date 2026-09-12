import {
  DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS,
  DEFAULT_EXTERNAL_CONTENT_BUDGET_MS,
  EXTERNAL_CONTENT_SUCCESS_MAX_BYTES,
  ReliabilityError,
  UPSTREAM_ERROR_MAX_BYTES,
  classifyHttpFailure,
  cancelResponseBody,
  getResponseHeader,
  normalizeTransportError,
  parseRetryAfter,
  parseUpstreamDiagnostic,
  readResponseBodyBounded,
  withReliabilityRetry,
} from './external-reliability'

export interface ExternalContentClientRuntimeOptions {
  fetchImpl?: typeof fetch
  now?: () => number
  random?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface ExternalContentRequestOptions {
  headers?: Record<string, string>
  totalTimeoutMs?: number
  attemptTimeoutMs?: number
  maxAttempts?: number
  maxRedirects?: number
  maxBytes?: number
  signal?: AbortSignal
}

export interface ExternalContentClientLike {
  getText(input: string | URL, options?: ExternalContentRequestOptions): Promise<string>
  getJson<T = unknown>(input: string | URL, options?: ExternalContentRequestOptions): Promise<T>
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const CREDENTIAL_HEADERS = new Set(['authorization', 'cookie', 'proxy-authorization', 'x-api-key', 'x-auth-token'])

/**
 * Restricted HTTP(S) GET transport for external feeds and JSON APIs.  It does
 * not parse RSS, Hacker News, or GitHub payloads; those rules stay in callers.
 */
export class ExternalContentClient implements ExternalContentClientLike {
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly random: () => number
  private readonly sleep: (ms: number) => Promise<void>
  private readonly defaults: ExternalContentRequestOptions

  constructor(runtime: ExternalContentClientRuntimeOptions = {}, defaults: ExternalContentRequestOptions = {}) {
    this.fetchImpl = runtime.fetchImpl ?? globalThis.fetch.bind(globalThis)
    this.now = runtime.now ?? Date.now
    this.random = runtime.random ?? Math.random
    this.sleep = runtime.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    this.defaults = { ...defaults }
  }

  async getText(input: string | URL, options: ExternalContentRequestOptions = {}): Promise<string> {
    const request = resolveOptions(this.defaults, options)
    const originalUrl = validateExternalUrl(input)
    const totalTimeoutMs = request.totalTimeoutMs ?? DEFAULT_EXTERNAL_CONTENT_BUDGET_MS
    const attemptTimeoutMs = request.attemptTimeoutMs ?? DEFAULT_EXTERNAL_CONTENT_ATTEMPT_TIMEOUT_MS
    const maxAttempts = request.maxAttempts ?? 3
    const maxRedirects = request.maxRedirects ?? 3
    const maxBytes = Math.min(request.maxBytes ?? EXTERNAL_CONTENT_SUCCESS_MAX_BYTES, EXTERNAL_CONTENT_SUCCESS_MAX_BYTES)
    if (!Number.isFinite(totalTimeoutMs) || totalTimeoutMs <= 0 || !Number.isFinite(attemptTimeoutMs) || attemptTimeoutMs <= 0) {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'External content deadline is invalid' })
    }
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3 || !Number.isInteger(maxRedirects) || maxRedirects < 0 || maxRedirects > 3) {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'External content retry policy is invalid' })
    }
    if (!Number.isFinite(maxBytes) || maxBytes < 0) {
      throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'External content size limit is invalid' })
    }

    return withReliabilityRetry(
      async ({ signal }) => {
        let url = originalUrl
        let headers = { ...(request.headers ?? {}) }
        for (let redirect = 0; ; redirect += 1) {
          let response: Response
          try {
            response = await this.fetchImpl(url.toString(), {
              method: 'GET',
              headers: {
                accept: 'text/plain, application/json;q=0.9, */*;q=0.8',
                ...headers,
              },
              redirect: 'manual',
              signal,
            })
          } catch (error) {
            throw normalizeTransportError(error)
          }

          if (!isResponseLike(response)) {
            throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'External content transport returned an invalid response' })
          }

          if (REDIRECT_STATUSES.has(response.status)) {
            if (redirect >= maxRedirects) {
              throw new ReliabilityError({ kind: 'upstream-rejected', retryable: false, status: response.status, message: 'External content redirect limit exceeded' })
            }
            const location = response.headers.get('location')
            if (!location) {
              throw new ReliabilityError({ kind: 'invalid-response', retryable: false, status: response.status, message: 'External content redirect location is missing' })
            }
            let nextUrl: URL
            try {
              nextUrl = new URL(location, url)
            } catch {
              throw new ReliabilityError({ kind: 'invalid-response', retryable: false, status: response.status, message: 'External content redirect URL is invalid' })
            }
            validateExternalUrl(nextUrl)
            if (nextUrl.origin !== url.origin) {
              headers = stripCredentialHeaders(headers)
            }
            // A redirect body is not part of the content contract. Cancel it
            // before following the location so it cannot remain attached to
            // the connection while the next request runs.
            await cancelResponseBody(response)
            url = nextUrl
            continue
          }

          if (!response.ok) {
            throw await responseError(response, credentialHeaderValues(headers))
          }
          return readResponseBodyBounded(response, { maxBytes })
        }
      },
      {
        maxAttempts,
        totalTimeoutMs,
        attemptTimeoutMs,
        retryOnTimeout: true,
        now: this.now,
        random: this.random,
        sleep: this.sleep,
        signal: request.signal,
      },
    )
  }

  async getJson<T = unknown>(input: string | URL, options: ExternalContentRequestOptions = {}): Promise<T> {
    const text = await this.getText(input, options)
    try {
      return JSON.parse(text) as T
    } catch (error) {
      throw new ReliabilityError({ kind: 'invalid-response', retryable: false, message: 'External content response was not valid JSON', cause: error })
    }
  }
}

export function createExternalContentClient(
  runtime?: ExternalContentClientRuntimeOptions,
  defaults?: ExternalContentRequestOptions,
): ExternalContentClient {
  return new ExternalContentClient(runtime, defaults)
}

function resolveOptions(
  defaults: ExternalContentRequestOptions,
  options: ExternalContentRequestOptions,
): ExternalContentRequestOptions {
  return {
    ...defaults,
    ...options,
    headers: { ...(defaults.headers ?? {}), ...(options.headers ?? {}) },
  }
}

export function validateExternalUrl(input: string | URL): URL {
  let url: URL
  try {
    url = input instanceof URL ? new URL(input.toString()) : new URL(input)
  } catch {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'External content URL is invalid' })
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) {
    throw new ReliabilityError({ kind: 'configuration', retryable: false, message: 'External content URL must be HTTP(S) without credentials' })
  }
  return url
}

function stripCredentialHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !CREDENTIAL_HEADERS.has(key.toLowerCase())))
}

function credentialHeaderValues(headers: Record<string, string>): string[] {
  return Object.entries(headers)
    .filter(([name, value]) => CREDENTIAL_HEADERS.has(name.toLowerCase()) && value.length > 0)
    .map(([, value]) => value)
}

async function responseError(response: Response, secrets: readonly string[] = []): Promise<ReliabilityError> {
  let body = ''
  try {
    body = await readResponseBodyBounded(response, { maxBytes: UPSTREAM_ERROR_MAX_BYTES, secrets })
  } catch {
    // Preserve status classification when an error body cannot be read.
  }
  const diagnostic = parseUpstreamDiagnostic(body, { secrets })
  return classifyHttpFailure(response.status, {
    // Do not expose an upstream message: feeds can echo arbitrary source
    // content and the transport boundary must never return prompt/body text.
    message: undefined,
    upstreamCode: diagnostic.code,
    requestId: diagnostic.requestId ?? getResponseHeader(response, 'x-request-id') ?? getResponseHeader(response, 'request-id') ?? undefined,
    retryAfterMs: parseRetryAfter(getResponseHeader(response, 'retry-after')),
    secrets,
  })
}

function isResponseLike(value: unknown): value is Response {
  return Boolean(value && typeof value === 'object' && typeof (value as { ok?: unknown }).ok === 'boolean')
}
