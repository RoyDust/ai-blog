import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_RETRY_BASE_DELAY_MS,
  ReliabilityError,
  classifyHttpFailure,
  isRetryableHttpStatus,
  normalizeTransportError,
  parseUpstreamDiagnostic,
  readResponseBodyBounded,
  scrubUpstreamDiagnostic,
  scrubUrlDiagnostic,
  withLocalDeadline,
  withReliabilityRetry,
} from '../external-reliability'

function responseWithStream(chunks: Uint8Array[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
  return new Response(body, init)
}

describe('external reliability primitives', () => {
  it('enforces Content-Length before reading a response', async () => {
    let pulled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled = true
        controller.close()
      },
    })
    const response = new Response(body, { status: 200, headers: { 'content-length': '11' } })
    await expect(readResponseBodyBounded(response, { maxBytes: 10 })).rejects.toMatchObject({
      kind: 'response-too-large',
      retryable: false,
    })
    expect(pulled).toBe(false)
  })

  it('counts streamed bytes and cancels after the limit', async () => {
    let cancelled = false
    const body = {
      getReader: () => ({
        read: async () => ({ done: false, value: new TextEncoder().encode('12345') }),
        cancel: async () => { cancelled = true },
        releaseLock: () => {},
      }),
    } as unknown as ReadableStream<Uint8Array>
    const response = {
      status: 200,
      headers: new Headers(),
      body,
      text: async () => '',
    } as unknown as Response
    await expect(readResponseBodyBounded(response, { maxBytes: 4 })).rejects.toMatchObject({ kind: 'response-too-large' })
    expect(cancelled).toBe(true)
  })

  it('reads a bounded response exactly at the byte limit', async () => {
    const response = responseWithStream([
      new Uint8Array([0xe2, 0x82]),
      new Uint8Array([0xac]),
    ])
    await expect(readResponseBodyBounded(response, 3)).resolves.toBe('€')
  })

  it('classifies the fixed HTTP retry set', () => {
    for (const status of [408, 425, 429, 500, 502, 503, 504]) {
      expect(isRetryableHttpStatus(status)).toBe(true)
      expect(classifyHttpFailure(status).retryable).toBe(true)
    }
    for (const status of [400, 401, 403, 404, 409, 422, 499]) {
      expect(isRetryableHttpStatus(status)).toBe(false)
      expect(classifyHttpFailure(status).retryable).toBe(false)
    }
    expect(classifyHttpFailure(429).kind).toBe('rate-limited')
    expect(classifyHttpFailure(500).kind).toBe('transient-upstream')
    expect(classifyHttpFailure(400).kind).toBe('upstream-rejected')
  })

  it('uses full-jitter backoff and honors bounded Retry-After', async () => {
    let now = 0
    const sleeps: number[] = []
    let attempts = 0
    const result = await withReliabilityRetry(
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw new ReliabilityError({ kind: 'transient-upstream', retryable: true, status: 503 })
        }
        return 'ok'
      },
      {
        maxAttempts: 2,
        totalTimeoutMs: 10_000,
        now: () => now,
        random: () => 1,
        sleep: async (ms) => {
          sleeps.push(ms)
          now += ms
        },
      },
    )
    expect(result).toBe('ok')
    expect(sleeps).toEqual([DEFAULT_RETRY_BASE_DELAY_MS])

    attempts = 0
    sleeps.length = 0
    now = 0
    await withReliabilityRetry(
      async () => {
        attempts += 1
        if (attempts === 1) {
          throw classifyHttpFailure(429, { retryAfterMs: 9_000 })
        }
        return 'ok'
      },
      {
        maxAttempts: 2,
        totalTimeoutMs: 20_000,
        now: () => now,
        random: () => 0,
        sleep: async (ms) => { sleeps.push(ms); now += ms },
      },
    )
    expect(sleeps).toEqual([5_000])
  })

  it('does not retry timeout unless the caller explicitly allows it', async () => {
    const operation = vi.fn(async () => {
      throw new ReliabilityError({ kind: 'timeout', retryable: false })
    })
    await expect(withReliabilityRetry(operation, {
      maxAttempts: 3,
      totalTimeoutMs: 1_000,
      sleep: async () => {},
    })).rejects.toMatchObject({ kind: 'timeout' })
    expect(operation).toHaveBeenCalledTimes(1)

    operation.mockClear()
    await expect(withReliabilityRetry(operation, {
      maxAttempts: 3,
      totalTimeoutMs: 1_000,
      retryOnTimeout: true,
      sleep: async () => {},
    })).rejects.toMatchObject({ kind: 'timeout' })
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('scrubs secrets, bearer values, and sensitive URL query parameters', () => {
    const secret = 'sk-live-abc'
    const message = scrubUpstreamDiagnostic(
      `Authorization: Bearer ${secret}; ?token=${secret}&x=1`,
      { secrets: [secret] },
    )
    expect(message).not.toContain(secret)
    expect(message).toContain('[redacted]')
    expect(scrubUrlDiagnostic(`https://user:pass@example.test/path?api_key=${secret}`)).toBe('https://example.test/path')
    const parsed = parseUpstreamDiagnostic(JSON.stringify({ error: { code: 'bad', message: `no ${secret}` } }), { secrets: [secret] })
    expect(parsed).toEqual({ code: 'bad', message: 'no [redacted]' })

    const arbitraryBearer = scrubUpstreamDiagnostic('Authorization: Bearer provider-echoed-token')
    expect(arbitraryBearer).not.toContain('provider-echoed-token')
  })

  it('does not retry certificate or invalid-protocol failures', () => {
    const certificate = Object.assign(new TypeError('fetch failed'), { cause: Object.assign(new Error('certificate failure'), { code: 'CERT_HAS_EXPIRED' }) })
    expect(normalizeTransportError(certificate).retryable).toBe(false)
    expect(normalizeTransportError(new TypeError('Invalid URL')).retryable).toBe(false)
  })

  it('returns a timeout error when the local deadline expires', async () => {
    await expect(withLocalDeadline(
      () => new Promise<string>(() => {}),
      { timeoutMs: 10 },
    )).rejects.toMatchObject({ kind: 'timeout', retryable: false })
  })

  it('does not retain an untrusted cause on a public reliability error', () => {
    const cause = new Error('upstream echoed secret-key')
    const error = new ReliabilityError({
      kind: 'network',
      retryable: true,
      cause,
      message: 'network failure',
    })

    expect((error as Error & { cause?: unknown }).cause).toBeUndefined()
    expect(JSON.stringify(error)).not.toContain('secret-key')
  })

  it('rejects invalid retry limits before invoking the operation', async () => {
    const operation = vi.fn(async () => 'ok')

    await expect(withReliabilityRetry(operation, {
      maxAttempts: Number.NaN,
      totalTimeoutMs: 100,
    })).rejects.toMatchObject({ kind: 'configuration' })
    expect(operation).not.toHaveBeenCalled()
  })
})
