import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueEmail, type CreatedPost } from "./helpers"
import { createNewsletterPool, verifyNewsletterSubscriber, withNewsletterSettings } from "./newsletter-fixtures"

/** E22：经真实表单订阅、验证；退出时恢复设置并清理测试订阅者。 */
test("E22 newsletter subscribe verify", async ({ page }) => {
  test.setTimeout(180_000)
  const pool = createNewsletterPool()
  const email = uniqueEmail("newsletter")
  let post: CreatedPost | undefined

  try {
    await withNewsletterSettings(page.request, async () => {
      try {
        post = await createPostViaApi(page.request, { published: true })
        await page.goto("/posts/" + post.slug)
        await page.getByLabel("邮箱地址").fill(email)
        await page.getByRole("button", { name: "订阅", exact: true }).click()
        await expect(page.getByText("订阅请求已提交，请检查邮箱完成确认。")).toBeVisible({ timeout: 30_000 })

        await verifyNewsletterSubscriber(page.request, pool, email)
        const response = await page.request.get("/api/admin/newsletter/subscribers?status=verified&q=" + encodeURIComponent(email))
        expect(response.ok()).toBe(true)
        const subscribers = await response.json()
        expect(subscribers.data).toEqual([expect.objectContaining({ email, status: "verified" })])
        expect(subscribers.stats.verified).toBeGreaterThan(0)

        // 后台只展示订阅者统计，不展示邮箱列表；邮箱身份由管理 API 核验。
        await page.goto("/admin/newsletter")
        const verifiedCard = page.getByText("发送活动的目标人群", { exact: true }).locator("..")
        await expect(verifiedCard.getByText(subscribers.stats.verified.toLocaleString("zh-CN"), { exact: true })).toBeVisible()
      } finally {
        await Promise.all([
          post ? deletePostViaApi(page.request, post.id) : Promise.resolve(),
          pool.query("DELETE FROM newsletter_subscribers WHERE email = $1", [email]),
        ])
      }
    })
  } finally {
    await pool.end()
  }
})
