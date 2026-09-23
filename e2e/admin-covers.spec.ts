import { expect, test } from "@playwright/test"

import { uniqueSlug } from "./helpers"

/**
 * E16 封面库。
 *
 * 走 POST /api/admin/covers 手动 URL 建 CoverAsset（不碰七牛真实上传），
 * 文章封面直接引用该 URL。详情页封面 img 以 alt（文章标题）断言——
 * next/image 会把 src 代理成 /_next/image?url=<encoded>，按 src 匹配不可靠。
 */
test("E16 cover asset created via API and used on post", async ({ page }) => {
  const slug = uniqueSlug("cover")
  const title = `E2E 封面文章 ${Date.now()}`
  const coverUrl = "https://project.roydust.top/e2e-cover.jpg"

  // 建封面资产
  const createResponse = await page.request.post("/api/admin/covers", {
    data: {
      url: coverUrl,
      title: `E2E 封面 ${Date.now()}`,
      alt: title,
      source: "manual",
    },
  })
  expect(createResponse.status(), "create cover should succeed").toBeLessThan(300)

  // 建已发布文章，封面字段直接指向该 URL
  const postResponse = await page.request.post("/api/admin/posts", {
    data: {
      title,
      slug,
      content: "# 封面测试\n\n正文。",
      published: true,
      coverImage: coverUrl,
    },
  })
  expect(postResponse.status()).toBeLessThan(300)
  const post = (await postResponse.json())?.data

  try {
    // 详情页封面 img 渲染（按 alt 定位）
    await page.goto(`/posts/${slug}`)
    await expect(page.getByRole("img", { name: title })).toBeVisible({ timeout: 20_000 })

    // 封面库列表可见该资产
    await page.goto("/admin/covers")
    await expect(page.locator("text=E2E 封面").first()).toBeVisible({ timeout: 20_000 })
  } finally {
    if (post?.id) {
      await page.request.delete(`/api/admin/posts?ids=${encodeURIComponent(post.id)}`).catch(() => undefined)
    }
  }
})
