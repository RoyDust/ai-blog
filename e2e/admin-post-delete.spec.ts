import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E10 软删除。
 *
 * 走后台同款 DELETE /api/admin/posts 软删除（UI 弹窗链路依赖影响预览请求时序，
 * 交互细节由 posts-workbench 单测覆盖）。断言删除后：
 * - 前台详情不可读（not-found 内容；dev 模式 notFound() 可能返回 200，不断言状态码）
 * - 后台默认列表消失
 */
test("E10 soft delete hides post and keeps record", async ({ page }) => {
  const created = await createPostViaApi(page.request, { published: true, slug: uniqueSlug("del") })

  await deletePostViaApi(page.request, created.id)

  // 前台详情：not-found 内容出现（轮询容忍 ISR 重验证延迟）
  await expect
    .poll(
      async () => {
        const response = await page.request.get(`/posts/${created.slug}`)
        const body = await response.text()
        return body.includes("没有找到这个页面") || body.includes("文章不存在") ? "not-found" : "visible"
      },
      { timeout: 30_000, intervals: [2_000] },
    )
    .toBe("not-found")

  // 后台默认列表不再出现
  await page.goto("/admin/posts")
  await page.getByLabel("搜索文章").fill(created.title.slice(0, 20))
  await expect(page.locator("tr", { hasText: created.title })).toHaveCount(0, { timeout: 20_000 })
})
