import { expect, test } from "@playwright/test"

import { uniqueSlug } from "./helpers"

/**
 * E13 标签 CRUD（TaxonomyStudio 标签 tab）。
 * 新增（含默认颜色）→ 列表出现 → 编辑改名（slug 同步为合法值）→ 保存 → 隐藏。
 */
test("E13 tag create rename hide", async ({ page }) => {
  const slug = uniqueSlug("tag")
  const name = `E2E标签${Date.now()}`
  const renamedSlug = uniqueSlug("tag2")

  await page.goto("/admin/taxonomy")
  await page.getByRole("button", { name: "标签", exact: true }).click()

  // 新增标签（右侧表单：新增标签，颜色默认 #0f766e）
  await page.getByLabel("名称").fill(name)
  await page.getByLabel("Slug", { exact: true }).fill(slug)
  await page.getByRole("button", { name: "新增标签" }).click()
  await expect(page.getByText("标签已创建")).toBeVisible({ timeout: 15_000 })

  // 列表可见
  await page.getByPlaceholder("搜索标签").fill(name)
  const row = page.locator("tr", { hasText: name }).first()
  await row.waitFor({ state: "visible", timeout: 20_000 })

  // 编辑改名（slug 手动同步为合法值）
  await row.getByRole("button", { name: "编辑" }).click()
  await page.getByLabel("名称").fill(`${name}改`)
  await page.getByLabel("Slug", { exact: true }).fill(renamedSlug)
  await page.getByRole("button", { name: "保存修改" }).click()
  await expect(page.getByText("标签已保存")).toBeVisible({ timeout: 15_000 })

  // 隐藏
  await page.getByPlaceholder("搜索标签").fill(name)
  const row2 = page.locator("tr", { hasText: `${name}改` }).first()
  await row2.waitFor({ state: "visible", timeout: 20_000 })
  await row2.getByRole("button", { name: "隐藏" }).click()
  await page.getByRole("button", { name: "确认隐藏" }).click()
  await expect(page.locator("tr", { hasText: `${name}改` })).toHaveCount(0, { timeout: 20_000 })
})
