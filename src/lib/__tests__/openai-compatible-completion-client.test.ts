import { describe, expect, it, vi } from 'vitest'
import {
  OpenAICompatibleCompletionClient,
  extractJsonText,
} from '../openai-compatible-completion-client'

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    ...init,
  })
}

function fetchMock(...responses: Response[]): typeof fetch {
  const mock = vi.fn(async () => responses.shift() ?? new Response('{}', { status: 500 }))
  return mock as unknown as typeof fetch
}

const messages = [{ role: 'user', content: 'hello' }] as const

describe('OpenAICompatibleCompletionClient', () => {
  it('posts the compatible chat request and extracts string content', async () => {
    const fetchImpl = fetchMock(jsonResponse({
      model: 'demo',
      choices: [{ message: { role: 'assistant', content: '  answer  ' }, finish_reason: 'stop' }],
    }))
    const client = new OpenAICompatibleCompletionClient({
      baseUrl: 'https://provider.example/v1',
      model: 'demo',
      apiKey: 'sk-test-secret',
    }, { fetchImpl, sleep: async () => {} })

    await expect(client.completeText(messages)).resolves.toEqual({ text: 'answer', model: 'demo', finishReason: 'stop' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://provider.example/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ authorization: 'Bearer sk-test-secret', 'content-type': 'application/json' })
    expect(JSON.parse(String(init.body))).toEqual({ model: 'demo', messages })
  })

  it('does not allow provider headers to override the configured credential', async () => {
    const fetchImpl = fetchMock(jsonResponse({ choices: [{ message: { content: 'ok' } }] }))
    const client = new OpenAICompatibleCompletionClient({
      baseUrl: 'https://provider.example',
      model: 'demo',
      apiKey: 'configured-secret',
      headers: {
        Authorization: 'Bearer stale-secret',
        Cookie: 'sid=stale-secret',
        'X-Provider': 'keep',
      },
    }, { fetchImpl, sleep: async () => {} })

    await client.completeText(messages)
    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer configured-secret')
    expect(headers).not.toHaveProperty('Authorization')
    expect(headers).not.toHaveProperty('Cookie')
    expect(headers['X-Provider']).toBe('keep')
  })

  it('joins text parts and rejects missing or empty choices', async () => {
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'key' }, {
      fetchImpl: fetchMock(jsonResponse({ choices: [{ message: { content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] } }] })),
      sleep: async () => {},
    })
    await expect(client.completeText(messages)).resolves.toMatchObject({ text: 'ab' })

    const missing = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'key' }, {
      fetchImpl: fetchMock(jsonResponse({ choices: [] })), sleep: async () => {},
    })
    await expect(missing.completeText(messages)).rejects.toMatchObject({ kind: 'invalid-response', retryable: false })

    const empty = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'key' }, {
      fetchImpl: fetchMock(jsonResponse({ choices: [{ message: { content: '' } }] })), sleep: async () => {},
    })
    await expect(empty.completeText(messages)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('retries retryable HTTP failures at most once for completion POST', async () => {
    const fetchImpl = fetchMock(
      new Response(JSON.stringify({ error: { code: 'busy', message: 'try later' } }), { status: 503, headers: { 'retry-after': '1' } }),
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    )
    const sleeps: number[] = []
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, {
      fetchImpl,
      random: () => 1,
      sleep: async (ms) => { sleeps.push(ms) },
    })
    await expect(client.completeText(messages)).resolves.toMatchObject({ text: 'ok' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([1_000])
  })

  it('does not retry a completion attempt timeout', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}))
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, { fetchImpl })
    await expect(client.completeText(messages, { budgetMs: 30, attemptTimeoutMs: 10 })).rejects.toMatchObject({ kind: 'timeout' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('classifies circular request bodies as non-retryable configuration', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const sleep = vi.fn(async () => {})
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, {
      fetchImpl,
      sleep,
    })
    const circular: Record<string, unknown> = {}
    circular.self = circular

    await expect(client.completeText(messages, { bodyExtensions: circular })).rejects.toMatchObject({
      kind: 'configuration',
      retryable: false,
    })
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
  })

  it('bounds success and error bodies without exposing their contents', async () => {
    const tooLarge = new Response('x'.repeat(2 * 1024 * 1024 + 1), {
      status: 200,
      headers: { 'content-length': String(2 * 1024 * 1024 + 1) },
    })
    const largeClient = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, {
      fetchImpl: fetchMock(tooLarge), sleep: async () => {},
    })
    await expect(largeClient.completeText(messages)).rejects.toMatchObject({ kind: 'response-too-large' })

    const secretBody = `{"error":{"message":"secret-body-value"}}`
    const errorClient = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret-key' }, {
      fetchImpl: fetchMock(new Response(secretBody, { status: 400, headers: { 'content-length': String(64 * 1024 + 1) } })),
      sleep: async () => {},
    })
    const error = await errorClient.completeText(messages).catch((value: unknown) => value)
    expect(error).toMatchObject({ kind: 'upstream-rejected', status: 400 })
    expect(String((error as Error).message)).not.toContain('secret-body-value')
  })

  it('supports pure, fenced, and balanced JSON with string escapes', async () => {
    expect(extractJsonText('{"a":1}')).toBe('{"a":1}')
    expect(extractJsonText('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(extractJsonText('Result: ["a]", {"value":"{\\\"x\\\"}"}')).toBe('{"value":"{\\\"x\\\"}"}')

    const fetchImpl = fetchMock(jsonResponse({ choices: [{ message: { content: 'prefix ```json\n{"ok":true}\n``` suffix' } }] }))
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, {
      fetchImpl, sleep: async () => {},
    })
    await expect(client.completeJson(messages, (value) => {
      if (!value || typeof value !== 'object' || (value as { ok?: unknown }).ok !== true) throw new Error('bad')
      return 'decoded'
    })).resolves.toBe('decoded')
  })

  it('maps configuration and decoder failures to stable kinds', async () => {
    expect(() => new OpenAICompatibleCompletionClient({ baseUrl: 'ftp://provider.example', model: 'demo', apiKey: 'key' })).toThrowError(expect.objectContaining({ kind: 'configuration' }))
    const client = new OpenAICompatibleCompletionClient({ baseUrl: 'https://provider.example', model: 'demo', apiKey: 'secret' }, {
      fetchImpl: fetchMock(jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] })), sleep: async () => {},
    })
    await expect(client.completeJson(messages, () => { throw new Error('decoder secret') })).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
