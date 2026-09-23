import { expect, test } from "@playwright/test"

import { createCategoryViaApi } from "./helpers"

/**
 * E25 操作日志。
 * 管理操作（建分类）后 /admin/logs 出现对应记录（scope=admin, method=POST, path=/api/admin/categories）。
 */
test("E25 operation logs record admin actions", async ({ page }) => {
  // 触发一次管理操作
  const category = await createCategoryViaApi(page.request)

  await page.goto("/admin/logs")
  await expect(page.getByText("接口日志").first()).toBeVisible({ timeout: 20_000 })

  // 轮询列表出现刚才的操作（scope admin + categories 路径）
  await expect
    .poll(
      async () => {
        const response = await page.request.get("/api/admin/logs?limit=50")
        if (!response.ok()) return false
        const payload = await response.json()
        const logs = payload?.data?.items ?? []
        return logs.some(
          (log: { path?: string; scope?: string; operation?: string }) =>
            log.path === "/api/admin/categories" && log.scope === "admin",
        )
      },
      { timeout: 60_000, intervals: [2_000, 5_000] },
    )
    .toBe(true)

  // 页面 UI 渲染日志工作台
  await expect(page.locator("main")).toBeVisible()
})
