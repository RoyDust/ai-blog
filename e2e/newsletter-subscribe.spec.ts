import pg from "pg"

import { expect, test } from "@playwright/test"
import dotenv from "dotenv"

import { uniqueEmail } from "./helpers"

/**
 * E22 Newsletter 订阅全链路。
 *
 * - SystemSetting 直连 PG 开 newsletter（provider "log"）
 * - 订阅入口在文章详情页（settings.newsletter.enabled 开启时挂 NewsletterForm）
 * - 订阅响应只含 verificationRequired: true（token 全链路脱敏）
 * - 测试进程直连 PG 读 verification_token → /api/newsletter/verify → 状态 verified
 * - admin 邮件运营页「已验证」统计可见
 *
 * 注：dotenv/pg 直连是测试进程专用，静态导入即可（Playwright Node 运行时）。
 */

function getPool(): pg.Pool {
  dotenv.config({ path: ".env" })
  dotenv.config({ path: ".env.local" })
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured for E2E newsletter test")
  return new pg.Pool({ connectionString: process.env.DATABASE_URL })
}

async function enableNewsletterViaDb(pool: pg.Pool): Promise<void> {
  // 读当前 blog.site 设置，改 newsletter 段后回写（不覆盖其他段）
  const current = await pool.query("SELECT value FROM system_settings WHERE key = 'blog.site'")
  const value = (current.rows[0]?.value ?? {}) as Record<string, unknown>
  const next = {
    ...value,
    newsletter: {
      ...(value.newsletter as Record<string, unknown> | undefined),
      enabled: true,
      provider: "log",
      fromEmail: "e2e@test.local",
      replyTo: "e2e@test.local",
    },
  }

  await pool.query(
    "INSERT INTO system_settings (key, value, \"createdAt\", \"updatedAt\") VALUES ('blog.site', $1::jsonb, now(), now()) ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, \"updatedAt\" = now()",
    [JSON.stringify(next)],
  )
}

test("E22 newsletter subscribe verify", async ({ page }) => {
  test.setTimeout(180_000)
  const pool = getPool()
  let post: { id: string; slug: string } | null = null

  try {
    await enableNewsletterViaDb(pool)

    // 订阅入口在文章详情页（ISR 300s：开启 newsletter 后需要 revalidate，
    // 直连 PG 后调 API 生成一篇新文章，其详情页首渲染就带表单）
    const postResponse = await page.request.post("/api/admin/posts", {
      data: {
        title: `E2E 订阅页文章 ${Date.now()}`,
        slug: `e2e-nl-${Date.now()}`,
        content: "# 订阅测试\n\nE2E newsletter 入口页。",
        published: true,
      },
    })
    expect(postResponse.status()).toBeLessThan(300)
    post = (await postResponse.json())?.data
    expect(post?.slug, "created post should include slug").toBeTruthy()

    const email = uniqueEmail("newsletter")
    await page.goto(`/posts/${post!.slug}`)
    const emailInput = page.getByLabel("邮箱地址")
    await emailInput.waitFor({ state: "visible", timeout: 30_000 })
    await emailInput.fill(email)
    await page.getByRole("button", { name: "订阅", exact: true }).click()

    // 表单内联 status 反馈（不走 toast）
    await expect(page.getByText("订阅请求已提交，请检查邮箱完成确认。")).toBeVisible({ timeout: 30_000 })

    // 订阅接口响应不含 token（脱敏契约）
    // （NewsletterForm 内部消费响应；这里直连 PG 验证落库 + token 脱敏已由 API 契约测试覆盖）

    // 直连 PG 读 token 并验证（列名 camelCase：verificationToken）
    const row = await pool.query('SELECT "verificationToken", status FROM newsletter_subscribers WHERE email = $1', [email])
    expect(row.rows).toHaveLength(1)
    expect(row.rows[0].status).toBe("pending")
    const token = row.rows[0].verificationToken
    expect(token).toBeTruthy()

    const verifyResponse = await page.request.get(`/api/newsletter/verify?token=${encodeURIComponent(token)}`)
    expect(verifyResponse.status()).toBeLessThan(300)

    const verified = await pool.query("SELECT status FROM newsletter_subscribers WHERE email = $1", [email])
    expect(verified.rows[0].status).toBe("verified")

    // admin 邮件运营页「已验证」统计可见
    await page.goto("/admin/newsletter")
    await expect(page.getByText("已验证").first()).toBeVisible({ timeout: 20_000 })
  } finally {
    if (post?.id) {
      await page.request.delete(`/api/admin/posts?ids=${encodeURIComponent(post.id)}`).catch(() => undefined)
    }
    await pool.end()
  }
})
