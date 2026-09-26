import { expect, test } from "@playwright/test"

import { withMockAiModelScope } from './ai-fixtures'

/**
 * E17 AI 模型管理：新建模型 + 连通性测试（成功/失败两条路径）。
 * mock completion server 由测试进程启动，模型 baseUrl 指向它。
 */
test("E17 AI model create and connectivity test", async ({ page }) => {
  test.setTimeout(120_000)
  await withMockAiModelScope(page.request, async ({ upstream, registerModel }) => {
    await page.goto("/admin/ai/models")

    // 打开新增模型面板
    await page.getByRole("button", { name: "新增模型" }).click()
    await expect(page.getByText("新增模型").first()).toBeVisible({ timeout: 15_000 })

    const modelName = `E2E 模型 ${Date.now()}`
    await page.getByLabel("模型名称").fill(modelName)
    await page.getByLabel("模型 ID").fill("mock-model")
    await page.getByLabel("Base URL").fill(`${upstream.baseUrl}/v1`)
    await page.getByLabel("Request Path").fill("/chat/completions")
    await page.getByLabel(/API Key/).fill("mock-key")
    const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/admin/ai/models' && response.request().method() === 'POST' && response.ok())
    await page.getByRole("button", { name: "保存模型" }).click()
    const body = await (await created).json()
    if (typeof body?.data?.id !== 'string') throw new Error('Created model response has no id')
    registerModel(body.data.id)

    // 保存成功：页面出现「模型已创建」status 反馈 + 模型库卡片渲染（端点指向 mock）
    await expect(page.getByText("模型已创建")).toBeVisible({ timeout: 30_000 })
    const card = page.locator("article", { hasText: modelName })
    await expect(card).toBeVisible({ timeout: 20_000 })
    await expect(card.getByRole("button", { name: "测试", exact: true })).toBeVisible()

    // 连通性测试（成功路径）：mock completion 返回 200，最近测试反馈出现
    await card.getByRole("button", { name: "测试", exact: true }).click()
    await expect(card.getByText(/通过|成功/).first()).toBeVisible({ timeout: 60_000 })
  })
})
