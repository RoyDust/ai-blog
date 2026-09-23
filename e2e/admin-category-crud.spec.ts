import { expect, test } from "@playwright/test"

import { uniqueSlug } from "./helpers"

/**
 * E12 分类 CRUD（TaxonomyStudio /admin/taxonomy 分类 tab）。
 * 新增 → 列表出现 → 编辑改名（slug 同步改，避免派生 slug 非法）→ 保存 → 隐藏。
 *
 * 稳定性：等「新增分类」heading 渲染（RHF 表单挂载完成）再 fill；
 * 每次提交前回读输入框值，防止表单 reset 时序清空输入。
 * 注意：名称输入会派生 slug（中文转拼音），编辑时手动把 slug 也改掉。
 */
test("E12 category create rename hide", async ({ page }) => {
  const slug = uniqueSlug("cat")
  const name = `E2E分类${Date.now()}`
  const renamedSlug = uniqueSlug("cat2")

  await page.goto("/admin/taxonomy")
  const nameInput = page.getByLabel("名称")
  const slugInput = page.getByLabel("Slug", { exact: true })
  await page.getByRole("heading", { name: "新增分类" }).waitFor({ state: "visible", timeout: 20_000 })

  // 新增分类（右侧常驻表单：新增分类）
  await nameInput.fill(name)
  await slugInput.fill(slug)
  await expect(nameInput).toHaveValue(name)
  await expect(slugInput).toHaveValue(slug)

  await page.getByRole("button", { name: "新增分类" }).click()
  await expect(page.getByText("分类已创建")).toBeVisible({ timeout: 15_000 })

  // 列表可见
  await page.getByPlaceholder("搜索分类").fill(name)
  const row = page.locator("tr", { hasText: name }).first()
  await row.waitFor({ state: "visible", timeout: 20_000 })

  // 编辑改名（slug 手动同步为合法值）
  await row.getByRole("button", { name: "编辑" }).click()
  await nameInput.fill(`${name}改`)
  await slugInput.fill(renamedSlug)
  await expect(nameInput).toHaveValue(`${name}改`)
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
