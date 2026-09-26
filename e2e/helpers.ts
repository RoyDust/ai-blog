import { expect, type APIRequestContext, type Page } from "@playwright/test"

/**
 * E2E 公共 helpers。
 *
 * 约定：
 * - 所有创建的数据用 `e2e-` 前缀 + 时间戳 slug / 邮箱，方便隔离与清理。
 * - 登录不在这里做：走 playwright.config.ts 的 setup project（storageState），
 *   避免 auth 限流（5 次/分/IP）打死用例。
 */

export const E2E_PREFIX = "e2e"

export function uniqueSlug(prefix = "post"): string {
  return `${E2E_PREFIX}-${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

export function uniqueEmail(prefix = "user"): string {
  return `${E2E_PREFIX}-${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@test.local`
}

type AdminCredentials = {
  email: string
  password: string
}

export function getAdminCredentials(): AdminCredentials {
  return {
    email: process.env.E2E_ADMIN_EMAIL || "e2e-admin@test.local",
    password: process.env.E2E_ADMIN_PASSWORD || "e2e-admin-password-2026",
  }
}

/**
 * 通过登录弹层（?login=1）以 Credentials 登录，并等待跳转完成。
 * 仅在 storageState 失效或全新 context 时使用（正常用例不应调用，避免限流）。
 */
export async function loginViaUi(page: Page, credentials = getAdminCredentials()): Promise<void> {
  await page.goto("/?login=1&callbackUrl=%2Fadmin")
  await page.getByLabel("邮箱").fill(credentials.email)
  await page.getByLabel("密码").fill(credentials.password)
  await page.getByRole("button", { name: "进入后台" }).click()
  await page.waitForURL(/\/admin/)
}

export type CreatedPost = {
  id: string
  slug: string
  title: string
}

type CreatePostInput = {
  title?: string
  slug?: string
  content?: string
  excerpt?: string
  published?: boolean
  categoryId?: string | null
  tagIds?: string[]
  seriesId?: string | null
}

/**
 * 经 admin API 创建文章（草稿或发布），返回 id/slug 供清理。
 */
export async function createPostViaApi(
  request: APIRequestContext,
  input: CreatePostInput = {},
): Promise<CreatedPost> {
  const slug = input.slug ?? uniqueSlug("post")
  const title = input.title ?? `E2E 测试文章 ${slug}`

  const response = await request.post("/api/admin/posts", {
    data: {
      title,
      slug,
      content: input.content ?? `# ${title}\n\nE2E 测试正文。`,
      excerpt: input.excerpt ?? "",
      published: input.published ?? false,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.tagIds ? { tagIds: input.tagIds } : {}),
      ...(input.seriesId !== undefined ? { seriesId: input.seriesId } : {}),
    },
  })

  expect(response.status(), "create post via API should succeed").toBeLessThan(300)

  const payload = await response.json()
  const id = payload?.data?.id
  expect(id, "create post response should include id").toBeTruthy()

  return { id: String(id), slug, title }
}

/**
 * 软删除一篇文章（与后台删除按钮同一端点，ids 走 query string）。
 */
export async function deletePostViaApi(request: APIRequestContext, id: string): Promise<void> {
  const response = await request.delete(`/api/admin/posts?ids=${encodeURIComponent(id)}`)

  expect(response.status(), "delete post via API should succeed").toBeLessThan(300)
}

export type AiTaskResult = {
  id: string
  status: string
  succeededCount: number
  failedCount: number
  items: Array<{ postId: string; status: string; applied: boolean }>
}

/** 等待任务完成；是否成功由调用方单独断言，失败终态不能当作成功。 */
export async function waitForAiTask(request: APIRequestContext, taskId: string): Promise<AiTaskResult> {
  let task: AiTaskResult | undefined
  await expect.poll(async () => {
    const response = await request.get(`/api/admin/ai/tasks/${encodeURIComponent(taskId)}`)
    expect(response.ok()).toBe(true)
    task = (await response.json()).data
    return task?.status
  }, { timeout: 180_000, intervals: [1_000, 2_000] }).toMatch(/^(SUCCEEDED|FAILED|PARTIAL_FAILED)$/)
  if (!task) throw new Error(`AI task ${taskId} returned no result`)
  return task
}

export type CreatedCategory = {
  id: string
  name: string
  slug: string
}

export async function createCategoryViaApi(
  request: APIRequestContext,
  name?: string,
): Promise<CreatedCategory> {
  const slug = uniqueSlug("cat")
  const response = await request.post("/api/admin/categories", {
    data: { name: name ?? `E2E 分类 ${slug}`, slug },
  })

  expect(response.status(), "create category via API should succeed").toBeLessThan(300)
  const payload = await response.json()
  return {
    id: String(payload?.data?.id ?? ""),
    name: name ?? `E2E 分类 ${slug}`,
    slug,
  }
}

export type CreatedTag = {
  id: string
  name: string
  slug: string
}

export async function createTagViaApi(request: APIRequestContext, name?: string): Promise<CreatedTag> {
  const slug = uniqueSlug("tag")
  const response = await request.post("/api/admin/tags", {
    data: { name: name ?? `E2E 标签 ${slug}`, slug },
  })

  expect(response.status(), "create tag via API should succeed").toBeLessThan(300)
  const payload = await response.json()
  return {
    id: String(payload?.data?.id ?? ""),
    name: name ?? `E2E 标签 ${slug}`,
    slug,
  }
}
