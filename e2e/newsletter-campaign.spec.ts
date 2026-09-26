import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueEmail, uniqueSlug, type CreatedPost } from "./helpers"
import { createNewsletterPool, verifyNewsletterSubscriber, withNewsletterSettings } from "./newsletter-fixtures"

/** E23：独立准备已验证订阅者，核验本次 campaign 的实际投递结果。 */
test("E23 newsletter campaign delivers to its verified subscriber", async ({ page }) => {
  test.setTimeout(180_000)
  const pool = createNewsletterPool()
  const email = uniqueEmail("campaign")
  const campaignTitle = uniqueSlug("campaign")
  let post: CreatedPost | undefined

  try {
    await withNewsletterSettings(page.request, async () => {
      try {
        const subscribed = await page.request.post("/api/newsletter/subscribe", { data: { email } })
        expect(subscribed.ok()).toBe(true)
        expect((await subscribed.json()).data.mail).toMatchObject({ delivered: true, provider: "log" })
        await verifyNewsletterSubscriber(page.request, pool, email)
        post = await createPostViaApi(page.request, { published: true })

        await page.goto("/admin/newsletter")
        await page.getByLabel("活动名称").fill(campaignTitle)
        await page.getByLabel("邮件主题").fill(campaignTitle)
        await page.getByLabel("文章 ID").fill(post.id)
        const [created] = await Promise.all([
          page.waitForResponse((response) => new URL(response.url()).pathname === "/api/admin/newsletter/campaigns" && response.request().method() === "POST"),
          page.getByRole("button", { name: "创建草稿" }).click(),
        ])
        expect(created.ok()).toBe(true)
        const campaign = (await created.json()).data
        expect(campaign.id).toBeTruthy()
        await expect(page.getByText("邮件活动草稿已创建")).toBeVisible({ timeout: 30_000 })

        const row = page.locator("tr", { hasText: campaignTitle })
        await row.getByRole("button", { name: "发送" }).click()
        await expect(row.getByText("已发送", { exact: true })).toBeVisible({ timeout: 60_000 })

        const response = await page.request.get("/api/admin/newsletter/campaigns/" + campaign.id)
        expect(response.ok()).toBe(true)
        const delivered = (await response.json()).data
        expect(delivered.status).toBe("SENT")
        expect(delivered.deliveryStats.sent).toBeGreaterThan(0)
        expect(delivered.deliveryStats.failed).toBe(0)
        expect(delivered.deliveries).toEqual(expect.arrayContaining([
          expect.objectContaining({ email, status: "sent", sentAt: expect.any(String) }),
        ]))
      } finally {
        await Promise.all([
          post ? deletePostViaApi(page.request, post.id) : Promise.resolve(),
          // 删除本测试独有的 campaign 时，数据库会级联删除它的 delivery。
          pool.query("DELETE FROM newsletter_campaigns WHERE title = $1", [campaignTitle]),
          pool.query("DELETE FROM newsletter_subscribers WHERE email = $1", [email]),
        ])
      }
    })
  } finally {
    await pool.end()
  }
})
