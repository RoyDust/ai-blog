import { expect, test } from "@playwright/test"
import { createCategoryViaApi, createPostViaApi, deletePostViaApi } from "./helpers"
import { purgeOwnedPost } from "./post-fixtures"
import { withResourceScope } from "./resource-scope"

/**
 * E02 /posts 分类筛选与重置。
 *
 * /posts 前台列表是 useSWRInfinite 无限滚动（useInfinitePosts），没有页码 URL。
 * 断言：分类筛选改变列表（GET 参数提交 + 列表内容变化），筛选重置生效。
 */
test("E02 posts listing filter applies and resets", async ({ page }) => {
  await withResourceScope(async (defer) => {
    const category = await createCategoryViaApi(page.request)
    defer(async () => {
      const response = await page.request.delete(`/api/admin/categories?ids=${encodeURIComponent(category.id)}`)
      expect(response.ok(), "delete owned category should succeed").toBe(true)
    })

    const matchingPost = await createPostViaApi(page.request, { published: true, categoryId: category.id })
    defer(async () => {
      await deletePostViaApi(page.request, matchingPost.id)
      await purgeOwnedPost(matchingPost.id, matchingPost.slug)
    })
    const otherPost = await createPostViaApi(page.request, { published: true, categoryId: null })
    defer(async () => {
      await deletePostViaApi(page.request, otherPost.id)
      await purgeOwnedPost(otherPost.id, otherPost.slug)
    })

    await page.goto("/posts")
    await expect(page.getByRole("heading", { name: "全部文章" })).toBeVisible()
    const listing = page.getByTestId("posts-listing")
    const matchingLink = listing.locator(`a[href="/posts/${matchingPost.slug}"]`).first()
    const otherLink = listing.locator(`a[href="/posts/${otherPost.slug}"]`).first()
    await expect(matchingLink).toBeVisible({ timeout: 15_000 })
    await expect(otherLink).toBeVisible({ timeout: 15_000 })

    await page.getByLabel("分类筛选").click()
    await page.getByRole("option", { name: category.name, exact: true }).click()
    await page.getByRole("button", { name: "应用筛选" }).click()

    await expect(page).toHaveURL((url) => url.pathname === "/posts" && url.searchParams.get("category") === category.slug)
    await expect(matchingLink).toBeVisible()
    await expect(otherLink).toHaveCount(0)
    await expect(page.getByRole("link", { name: `分类: ${category.slug}`, exact: true })).toBeVisible()

    await page.getByRole("link", { name: "清空筛选", exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === "/posts" && url.search === "")
    await expect(matchingLink).toBeVisible()
    await expect(otherLink).toBeVisible()
  })
})
