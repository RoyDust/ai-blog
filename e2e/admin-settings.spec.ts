import { expect, test } from "@playwright/test"

/**
 * E26 设置页：站点基础 tab 改博客名称，前台 Navbar/Footer 同步。
 * siteName 真实消费链路：blogSettings.siteName → Navbar/Footer props；
 * revalidateBlogSettings 覆盖 "/" 等路径。
 * 注意：联系页邮箱走构建期内联的 NEXT_PUBLIC_CONTACT_EMAIL，不受设置页控制，勿断言。
 */
test("E26 site name syncs to public frontend", async ({ page }) => {
  test.setTimeout(120_000)
  const newName = `E2E 站点 ${Date.now()}`

  await page.goto("/admin/settings")

  // 切到「站点基础」tab
  await page.getByRole("tab", { name: /站点基础/ }).click()
  const nameInput = page.getByLabel("博客名称")
  await nameInput.waitFor({ state: "visible", timeout: 20_000 })
  const previousValue = await nameInput.inputValue()

  await nameInput.fill(newName)
  await page.getByRole("button", { name: "保存博客配置" }).click()
  await expect(page.getByText("博客配置已保存")).toBeVisible({ timeout: 15_000 })

  // 前台首页 Navbar/Footer 出现新名称（revalidate 后）
  await page.goto("/")
  await expect(page.locator("body")).toContainText(newName, { timeout: 30_000 })

  // 还原（避免污染开发库）
  await page.goto("/admin/settings")
  await page.getByRole("tab", { name: /站点基础/ }).click()
  await nameInput.fill(previousValue || "My Blog")
  await page.getByRole("button", { name: "保存博客配置" }).click()
  await expect(page.getByText("博客配置已保存")).toBeVisible({ timeout: 15_000 })
})
