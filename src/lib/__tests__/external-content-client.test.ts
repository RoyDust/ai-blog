import { describe, expect, it, vi } from 'vitest'
import { ExternalContentClient } from '../external-content-client'

function fetchMock(...responses: Response[]): typeof fetch {
  const mock = vi.fn(async () => responses.shift() ?? new Response('missing', { status: 500 }))
  return mock as unknown as typeof fetch
}

describe('ExternalContentClient', () => {
  it('gets bounded text and JSON over HTTP(S)', async () => {
    const textFetch = fetchMock(new Response('hello', { status: 200 }))
    const textClient = new ExternalContentClient({ fetchImpl: textFetch, sleep: async () => {} })
    await expect(textClient.getText('https://feeds.example.test/feed')).resolves.toBe('hello')
    expect(textFetch).toHaveBeenCalledWith('https://feeds.example.test/feed', expect.objectContaining({ method: 'GET', redirect: 'manual' }))

    const jsonClient = new ExternalContentClient({ fetchImpl: fetchMock(new Response('{"items":[1]}', { status: 200 })), sleep: async () => {} })
    await expect(jsonClient.getJson<{ items: number[] }>('https://feeds.example.test/feed')).resolves.toEqual({ items: [1] })
  })

  it('retries retryable statuses and GET timeouts within the finite budget', async () => {
    const statusFetch = fetchMock(
      new Response('busy', { status: 503, headers: { 'retry-after': '2' } }),
      new Response('ok', { status: 200 }),
    )
    const sleeps: number[] = []
    const statusClient = new ExternalContentClient({
      fetchImpl: statusFetch,
      random: () => 0,
      sleep: async (ms) => { sleeps.push(ms) },
    })
    await expect(statusClient.getText('https://feeds.example.test/feed')).resolves.toBe('ok')
    expect(statusFetch).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([2_000])

    let calls = 0
    const timeoutFetch = vi.fn<typeof fetch>(() => {
      calls += 1
      if (calls === 1) return new Promise<Response>(() => {})
      return Promise.resolve(new Response('ok', { status: 200 }))
    })
    const timeoutClient = new ExternalContentClient({ fetchImpl: timeoutFetch, sleep: async () => {} })
    await expect(timeoutClient.getText('https://feeds.example.test/feed', { totalTimeoutMs: 100, attemptTimeoutMs: 10 })).resolves.toBe('ok')
    expect(timeoutFetch).toHaveBeenCalledTimes(2)
  })

  it('follows redirects manually and strips credentials across origins', async () => {
    const fetchImpl = fetchMock(
      new Response(null, { status: 302, headers: { location: 'https://other.example.test/final' } }),
      new Response('done', { status: 200 }),
    )
    const client = new ExternalContentClient({ fetchImpl, sleep: async () => {} })
    await expect(client.getText('https://source.example.test/start', {
      headers: { Authorization: 'Bearer secret', Cookie: 'sid=secret', 'X-Custom': 'keep' },
    })).resolves.toBe('done')
    const calls = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][]
    expect(calls[0][1].headers).toMatchObject({ Authorization: 'Bearer secret', Cookie: 'sid=secret', 'X-Custom': 'keep' })
    expect(calls[1][1].headers).not.toHaveProperty('Authorization')
    expect(calls[1][1].headers).not.toHaveProperty('Cookie')
    expect(calls[1][1].headers).toHaveProperty('X-Custom', 'keep')
  })

  it('rejects credential URLs and excessive redirects', async () => {
    const client = new ExternalContentClient({ fetchImpl: fetchMock(new Response('ok')), sleep: async () => {} })
    await expect(client.getText('https://user:pass@example.test/feed')).rejects.toMatchObject({ kind: 'configuration' })

    const redirects = fetchMock(
      new Response(null, { status: 302, headers: { location: '/1' } }),
      new Response(null, { status: 302, headers: { location: '/2' } }),
      new Response(null, { status: 302, headers: { location: '/3' } }),
      new Response(null, { status: 302, headers: { location: '/4' } }),
    )
    const redirectClient = new ExternalContentClient({ fetchImpl: redirects, sleep: async () => {} })
    await expect(redirectClient.getText('https://feeds.example.test/start')).rejects.toMatchObject({ kind: 'upstream-rejected' })
    expect(redirects).toHaveBeenCalledTimes(4)
  })

  it('enforces the content size limit and classifies invalid JSON', async () => {
    const tooLarge = new Response('x', { status: 200, headers: { 'content-length': String(5 * 1024 * 1024 + 1) } })
    const client = new ExternalContentClient({ fetchImpl: fetchMock(tooLarge), sleep: async () => {} })
    await expect(client.getText('https://feeds.example.test/feed')).rejects.toMatchObject({ kind: 'response-too-large' })

    const badJson = new ExternalContentClient({ fetchImpl: fetchMock(new Response('not-json', { status: 200 })), sleep: async () => {} })
    await expect(badJson.getJson('https://feeds.example.test/feed')).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('does not retry non-retryable HTTP statuses', async () => {
    const fetchImpl = fetchMock(new Response('{"error":{"message":"secret"}}', { status: 401 }))
    const client = new ExternalContentClient({ fetchImpl, sleep: async () => {} })
    await expect(client.getText('https://feeds.example.test/feed')).rejects.toMatchObject({ kind: 'upstream-rejected', retryable: false, status: 401 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('scrubs credential header values echoed by an upstream error', async () => {
    const credential = 'cookie-secret-value'
    const fetchImpl = fetchMock(new Response(JSON.stringify({
      error: { message: `provider echoed ${credential}` },
    }), { status: 502 }))
    const client = new ExternalContentClient({ fetchImpl, sleep: async () => {} })

    const error = await client.getText('https://feeds.example.test/feed', {
      headers: { Cookie: credential },
      maxAttempts: 1,
    }).catch((value: unknown) => value)

    expect(error).toMatchObject({ kind: 'transient-upstream', status: 502 })
    expect(String((error as Error).message)).not.toContain(credential)
  })

  it('cancels a redirect body before following its location', async () => {
    let cancelled = false
    const redirectBody = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('redirect body'))
      },
      cancel() {
        cancelled = true
      },
    })
    const fetchImpl = fetchMock(
      new Response(redirectBody, { status: 302, headers: { location: '/next' } }),
      new Response('ok', { status: 200 }),
    )
    const client = new ExternalContentClient({ fetchImpl, sleep: async () => {} })

    await expect(client.getText('https://feeds.example.test/start')).resolves.toBe('ok')
    expect(cancelled).toBe(true)
  })
})
