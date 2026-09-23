import { expect, test } from "@playwright/test"

import { uniqueSlug } from "./helpers"

/**
 * E12 分类 CRUD（TaxonomyStudio /admin/taxonomy 分类 tab）。
 * 新增 → 列表出现 → 编辑改名（slug 同步改，避免派生 slug 非法）→ 保存 → 隐藏。
 *
 * 注意：名称输入会派生 slug（中文转拼音），编辑时手动把 slug 也改掉，
 * 否则 save 因 slug 含非法字符失败（ValidationError: Invalid slug）。
 */
test("E12 category create rename hide", async ({ page }) => {
  const slug = uniqueSlug("cat")
  const name = `E2E分类${Date.now()}`
  const renamedSlug = uniqueSlug("cat2")

  await page.goto("/admin/taxonomy")
  await expect(page.getByRole("button", { name: "分类", exact: true })).toBeVisible()

  // 新增分类（右侧常驻表单：新增分类）
  await page.getByLabel("名称").fill(name)
  await page.getByLabel("Slug", { exact: true }).fill(slug)
  await page.getByRole("button", { name: "新增分类" }).click()
  await expect(page.getByText("分类已创建")).toBeVisible({ timeout: 15_000 })

  // 列表可见
  await page.getByPlaceholder("搜索分类").fill(name)
  const row = page.locator("tr", { hasText: name }).first()
  await row.waitFor({ state: "visible", timeout: 20_000 })

  // 编辑改名（slug 手动同步为合法值）
  await row.getByRole("button", { name: "编辑" }).click()
  await page.getByLabel("名称").fill(`${name}改`)
  await page.getByLabel("Slug", { exact: true }).fill(renamedSlug)
  await page.getByRole("button", { name: "保存修改" }).click()
  await expect(page.getByText("分类已保存")).toBeVisible({ timeout: 15_000 })

  // 隐藏（软删除）
  await page.getByPlaceholder("搜索分类").fill(name)
  const row2 = page.locator("tr", { hasText: `${name}改` }).first()
  await row2.waitFor({ state: "visible", timeout: 20_000 })
  await row2.getByRole("button", { name: "隐藏" }).click()
  await page.getByRole("button", { name: "确认隐藏" }).click()
  await expect(page.locator("tr", { hasText: `${name}改` })).toHaveCount(0, { timeout: 20_000 })
})
