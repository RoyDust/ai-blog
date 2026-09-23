import { expect, test } from "@playwright/test"

/**
 * E21 AI 话题雷达。
 *
 * 无手动建话题入口（POST /api/admin/ai/topics 仅 materializeTopicsFromRecentCandidates）。
 * 「重新生成选题」是 server action 表单（materialize + revalidatePath，无 toast）。
 * 候选为空时返回空列表不报错——断言页面与状态 tab 正常渲染；
 * 有话题时走 WATCHING/PLANNED 状态操作（按钮触发表单提交 + revalidate）。
 */
test("E21 topic radar materialize and status transitions", async ({ page }) => {
  test.setTimeout(120_000)

  await page.goto("/admin/ai/topics?status=NEW")
  await expect(page.getByRole("heading", { name: "AI 选题池 / 内容雷达" })).toBeVisible({ timeout: 20_000 })

  // server action：materialize（可能空），成功后 revalidatePath 无 toast，断言回到本页
  await page.getByRole("button", { name: "重新生成选题" }).click()
  await page.waitForURL(/status=NEW/, { timeout: 30_000 })
  await expect(page.getByRole("link", { name: "新选题" })).toBeVisible()

  // 若有话题：走状态流转（NEW → WATCHING → PLANNED）
  const watchButton = page.getByRole("button", { name: "设为观察" }).first()
  if (await watchButton.isVisible().catch(() => false)) {
    await watchButton.click()
    await page.waitForLoadState("networkidle")

    await page.goto("/admin/ai/topics?status=WATCHING")
    const planButton = page.getByRole("button", { name: "加入规划" }).first()
    if (await planButton.isVisible().catch(() => false)) {
      await planButton.click()
      await page.waitForLoadState("networkidle")
      // PLANNED tab 里出现该话题（或至少状态 tab 可达）
      await page.goto("/admin/ai/topics?status=PLANNED")
      await expect(page.getByRole("link", { name: "已规划" })).toBeVisible()
    }
  }
})
