import type { APIRequestContext } from "@playwright/test"
import dotenv from "dotenv"
import pg from "pg"

/** 与 Next 服务保持相同优先级；显式 DATABASE_URL 始终优先。 */
export function createNewsletterPool(): pg.Pool {
  dotenv.config({ path: ".env.local", quiet: true })
  dotenv.config({ path: ".env", quiet: true })
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured for E2E")
  return new pg.Pool({ connectionString: process.env.DATABASE_URL })
}

/** 通过设置 API 修改并恢复 newsletter 段，两次写入都会失效前台缓存。 */
export async function withNewsletterSettings<T>(
  request: Pick<APIRequestContext, "get" | "patch">,
  run: () => Promise<T>,
): Promise<T> {
  const response = await request.get("/api/admin/settings/blog")
  if (!response.ok()) throw new Error(`Read newsletter settings failed: ${response.status()}`)
  const original = (await response.json()).data?.newsletter
  if (!original) throw new Error("Newsletter settings are missing")

  try {
    const enabled = await request.patch("/api/admin/settings/blog", {
      data: { newsletter: { ...original, enabled: true, provider: "log", fromEmail: "e2e@test.local", replyTo: "e2e@test.local" } },
    })
    if (!enabled.ok()) throw new Error(`Enable test newsletter failed: ${enabled.status()}`)
    return await run()
  } finally {
    const restored = await request.patch("/api/admin/settings/blog", { data: { newsletter: original } })
    if (!restored.ok()) throw new Error(`Restore newsletter settings failed: ${restored.status()}`)
  }
}

/** token 不由公开 API 返回，使用测试进程的数据库连接读取；先校验 GET 不改库，再走 POST 真实验证 API。 */
export async function verifyNewsletterSubscriber(request: APIRequestContext, pool: pg.Pool, email: string) {
  const row = await pool.query<{ verificationToken: string; status: string }>(
    'SELECT "verificationToken", status FROM newsletter_subscribers WHERE email = $1', [email],
  )
  const token = row.rows[0]?.verificationToken
  if (row.rows[0]?.status !== "pending" || !token) throw new Error("Test subscription did not create a pending token")

  const redirectResponse = await request.get(`/api/newsletter/verify?token=${encodeURIComponent(token)}`, {
    maxRedirects: 0,
  })
  if (redirectResponse.status() !== 302) {
    throw new Error(`Expected GET /api/newsletter/verify to redirect (302), got ${redirectResponse.status()}`)
  }
  const afterGet = await pool.query<{ status: string }>(
    "SELECT status FROM newsletter_subscribers WHERE email = $1", [email],
  )
  if (afterGet.rows[0]?.status !== "pending") {
    throw new Error("GET /api/newsletter/verify must not mutate pending subscriber before POST confirmation")
  }

  const response = await request.post("/api/newsletter/verify", { data: { token } })
  if (!response.ok()) throw new Error(`Verify test subscriber failed: ${response.status()}`)
  const payload = (await response.json()).data
  if (payload?.verified !== true || payload?.status !== "verified") {
    throw new Error("Test subscriber was not verified")
  }
}
