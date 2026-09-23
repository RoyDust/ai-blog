import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"

/**
 * E09 定时发布展示。
 *
 * 编辑页发布设置里填未来 scheduledAt → 「定时发布」按钮提交（成功后停留编辑页，无 toast）。
 * 断言：重新打开后 scheduledAt 回显（datetime-local 值非空）。
 */
test("E09 schedule publish shows scheduled state", async ({ page }) => {
  const created = await createPostViaApi(page.request, { published: false })

  try {
    await page.goto(`/admin/posts/${created.id}/edit`)
    await expect(page.getByRole("heading", { name: "编辑文章" })).toBeVisible({ timeout: 20_000 })

    // 发布设置面板里的定时输入（datetime-local）
    const scheduleInput = page.locator('input[type="datetime-local"]')
    await expect(scheduleInput).toBeVisible()

    const future = new Date(Date.now() + 2 * 60 * 60 * 1000)
    const pad = (value: number) => String(value).padStart(2, "0")
    const value = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`
    await scheduleInput.fill(value)

    await page.getByRole("button", { name: "定时发布" }).click()

    // 保存成功（无 toast）：等待保存往返后重新打开，scheduledAt 回显
    await page.waitForTimeout(2_000)
    await page.goto(`/admin/posts/${created.id}/edit`)
    await expect(scheduleInput).not.toHaveValue("", { timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, created.id).catch(() => undefined)
  }
})
