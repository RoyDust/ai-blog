import { expect, test } from "@playwright/test"

import { uniqueEmail } from "./helpers"

/**
 * E04 注册 → 登录 → 登出。
 *
 * - 注册走 /register 表单（时间戳邮箱，不触 auth 限流 5/分）
 * - 注册成功跳登录（?registered=true）
 * - 登录新账号 → 账号入口出现；登出后 /write 重新跳登录
 * - 全程干净 context（storageState 清空），不继承 admin 会话
 */
test.use({ storageState: { cookies: [], origins: [] } })

test("E04 register login logout cycle", async ({ page }) => {
  const email = uniqueEmail("register")
  const password = "e2e-register-password-2026"

  // 注册
  await page.goto("/register")
  await page.getByLabel("昵称").fill("E2E 注册用户")
  await page.getByLabel("邮箱").fill(email)
  await page.getByLabel("密码", { exact: true }).fill(password)
  await page.getByLabel("确认密码").fill(password)
  await page.getByRole("checkbox", { name: /服务条款/ }).check()
  await page.getByRole("button", { name: "创建账号" }).click()

  // 注册成功跳登录
  await page.waitForURL(/[?&]registered=true/, { timeout: 20_000 })

  // 登录（?registered=true 触发 GlobalLoginDialog）
  const dialog = page.getByRole("dialog")
  await dialog.getByLabel("邮箱").fill(email)
  await dialog.getByLabel("密码").fill(password)
  await dialog.getByRole("button", { name: "登录", exact: true }).click()

  // 普通用户登录成功：dialog 关闭（不走 /admin 跳转）
  await expect(dialog).toBeHidden({ timeout: 20_000 })

  // 登出：头部账号入口 → 下拉菜单「退出登录」
  const accountTrigger = page.getByRole("button", { name: /E2E 注册用户|账号菜单/ }).first()
  await accountTrigger.click()
  await page.getByRole("menuitem", { name: "退出登录" }).click()

  // 登出后 /write 重新跳登录
  await page.waitForURL(/\//, { timeout: 20_000 })
  await page.goto("/write")
  await expect(page).toHaveURL(/[?&]login=1/, { timeout: 15_000 })
})
