import type { APIRequestContext } from "@playwright/test"

import { startMockUpstream, type MockUpstream } from "./mock-upstream"
import { withResourceScope } from './resource-scope'

export async function withMockAiModelScope<T>(
  request: Pick<APIRequestContext, 'delete'>,
  run: (fixture: { upstream: MockUpstream; registerModel: (id: string) => void }) => Promise<T>,
  options: Parameters<typeof startMockUpstream>[0] = {},
): Promise<T> {
  return withResourceScope(async (defer) => {
    const upstream = await startMockUpstream(options)
    defer(() => upstream.close())
    return run({ upstream, registerModel(id) {
      defer(async () => {
        const response = await request.delete('/api/admin/ai/models/' + encodeURIComponent(id))
        if (!response.ok()) throw new Error('Delete E2E model failed: ' + response.status())
      })
    } })
  })
}

/** 每次请求显式指定临时模型；不改变开发库的默认模型。 */
export async function withMockAiModel<T>(
  request: Pick<APIRequestContext, "post" | "delete">,
  run: (fixture: { modelId: string; upstream: MockUpstream }) => Promise<T>,
  options: Parameters<typeof startMockUpstream>[0] = {},
): Promise<T> {
  return withMockAiModelScope(request, async ({ upstream, registerModel }) => {
    const response = await request.post("/api/admin/ai/models", {
      data: {
        name: `E2E 模型 ${Date.now()}`,
        model: "mock-model",
        baseUrl: `${upstream.baseUrl}/v1`,
        requestPath: "/chat/completions",
        apiKey: "mock-key",
        capabilities: ["post-summary"],
        isDefaultForSummary: false,
        enabled: true,
      },
    })
    if (!response.ok()) throw new Error(`Create E2E model failed: ${response.status()}`)
    const payload = await response.json()
    const modelId = payload?.data?.id
    if (!modelId) throw new Error("Create E2E model returned no id")
    registerModel(modelId)

    return await run({ modelId, upstream })
  }, options)
}
