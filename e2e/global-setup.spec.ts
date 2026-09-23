import { expect, test } from "@playwright/test"

import { getAdminCredentials } from "./helpers"

/**
 * storageState setup：整个 E2E 套件只做一次 UI 登录。
 * 避免 auth 限流（5 次/分/IP）——正常用例全部复用这里产出的会话。
 *
 * 登录走 GlobalLoginDialog（?login=1 弹层，dialog 模式按钮文案是「登录」）。
 * 结束时把会话手动保存到 e2e/.auth/admin.json（gitignore），
 * 供 chromium project 的 storageState 读取。
 */
const statePath = "e2e/.auth/admin.json"

test("seed admin storage state", async ({ page }) => {
  const credentials = getAdminCredentials()

  await page.goto("/?login=1&callbackUrl=%2Fadmin")
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("邮箱").fill(credentials.email)
  await dialog.getByLabel("密码").fill(credentials.password)
  await dialog.getByRole("button", { name: "登录", exact: true }).click()

  // dialog 登录成功且 ADMIN：window.location.assign("/admin")
  await page.waitForURL(/\/admin/, { timeout: 30_000 })
  await expect(page.locator("main")).toBeVisible()

  // 会话写入文件（cookies + localStorage）
  await page.context().storageState({ path: statePath })
})
