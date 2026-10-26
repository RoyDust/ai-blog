import { beforeEach, describe, expect, test, vi } from 'vitest'

const createLogMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-operation-logs', () => ({ createApiOperationLog: createLogMock }))

import { createAiUsageRecorder } from '@/lib/ai-completion-client'

describe('createAiUsageRecorder', () => {
  beforeEach(() => vi.clearAllMocks())

  test('records usage safely with an isolated call ID and stage', async () => {
    createLogMock.mockResolvedValue(null)
    const recordAttempt = createAiUsageRecorder({ id: 'deepseek-id', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', apiKey: 'sk-not-for-logs' }, 'ai.news.score')
    await recordAttempt({
      callId: 'call-test', attempt: 1, startedAt: '2026-10-26T00:00:00.000Z', durationMs: 72,
      statusCode: 200, success: true, model: 'deepseek-flash', finishReason: 'stop', errorKind: null,
      usage: { prompt_tokens: 120, completion_tokens: 44, total_tokens: 164, reasoning_tokens: 31, prompt_cache_hit_tokens: 16, prompt_cache_miss_tokens: 104 },
    })
    expect(createLogMock).toHaveBeenCalledTimes(1)
    const record = createLogMock.mock.calls[0][0]
    expect(record).toMatchObject({ scope: 'ai-usage', operation: 'ai.news.score', success: true, actorType: 'system', metadata: { callId: 'call-test', attempt: 1, modelId: 'deepseek-id', requestedModel: 'deepseek-v4-flash', responseModel: 'deepseek-flash', usageReported: true, usage: { prompt_tokens: 120, completion_tokens: 44, total_tokens: 164, reasoning_tokens: 31 } } })
    expect(record).not.toHaveProperty('requestBody')
    expect(JSON.stringify(record)).not.toContain('sk-not-for-logs')
  })

  test('preserves unknown usage and error class for failed upstream attempts', async () => {
    createLogMock.mockResolvedValue(null)
    const recordAttempt = createAiUsageRecorder({ baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' }, 'ai.completion')
    await recordAttempt({ callId: 'unknown', attempt: 1, startedAt: '2026-10-26T00:00:00.000Z', durationMs: 22, statusCode: 429, success: false, model: null, finishReason: null, usage: null, errorKind: 'rate-limited' })
    expect(createLogMock).toHaveBeenCalledWith(expect.objectContaining({ success: false, statusCode: 429, errorKind: 'rate-limited', metadata: expect.objectContaining({ usageReported: false, usage: null }) }))
  })
})
