import { expect, test, vi } from "vitest"

import { withMockAiModel, withMockAiModelScope } from "../../../e2e/ai-fixtures"

test("temporary AI models preserve the default and are removed after a failed test", async () => {
  const request = {
    post: vi.fn().mockResolvedValue({
      ok: () => true,
      status: () => 200,
      json: async () => ({ success: true, data: { id: "test-model" } }),
    }),
    delete: vi.fn().mockResolvedValue({ ok: () => true, status: () => 200 }),
  }
  const failure = new Error("test assertion failed")
  let upstreamUrl = ""

  await expect(withMockAiModel(request, async ({ modelId, upstream }) => {
    expect(modelId).toBe("test-model")
    upstreamUrl = upstream.baseUrl
    expect((await fetch(`${upstreamUrl}/rss`)).ok).toBe(true)
    throw failure
  })).rejects.toBe(failure)

  expect(request.post).toHaveBeenCalledWith("/api/admin/ai/models", {
    data: expect.objectContaining({ isDefaultForSummary: false }),
  })
  expect(request.delete).toHaveBeenCalledWith("/api/admin/ai/models/test-model")
  await expect(fetch(`${upstreamUrl}/rss`)).rejects.toThrow()
})

test('UI-acquired models are cleaned and original plus cleanup failures remain visible', async () => {
  const request = { delete: vi.fn().mockResolvedValue({ ok: () => false, status: () => 500 }) }
  const original = new Error('assertion after UI creation')
  let upstreamUrl = ''
  let failure: unknown
  try {
    await withMockAiModelScope(request, async ({ upstream, registerModel }) => {
      upstreamUrl = upstream.baseUrl
      registerModel('ui-created-model')
      throw original
    })
  } catch (error) { failure = error }
  expect(failure).toBeInstanceOf(AggregateError)
  expect((failure as AggregateError).errors[0]).toBe(original)
  expect((failure as AggregateError).errors[1].message).toContain('Delete E2E model failed')
  expect(request.delete).toHaveBeenCalledWith('/api/admin/ai/models/ui-created-model')
  await expect(fetch(upstreamUrl + '/rss')).rejects.toThrow()
})
