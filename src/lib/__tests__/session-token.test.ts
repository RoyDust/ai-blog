// @vitest-environment node
import { encode } from "next-auth/jwt"
import { afterEach, describe, expect, test, vi } from "vitest"

import { readSessionUserId } from "@/lib/session-token"

const SECRET = "unit-test-only-secret-0123456789abcdef"

function visitRequest(cookie?: string) {
  return new Request("http://localhost/api/analytics/visit", {
    method: "POST",
    headers: cookie ? { cookie } : {},
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("readSessionUserId", () => {
  test("decodes the user id from the NextAuth session cookie", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET)
    const token = await encode({ token: { id: "user-1", sub: "user-1", role: "USER" }, secret: SECRET })

    await expect(readSessionUserId(visitRequest(`theme=dark; next-auth.session-token=${token}`))).resolves.toBe("user-1")
  })

  test("returns null when the request carries no session cookie", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET)

    await expect(readSessionUserId(visitRequest())).resolves.toBeNull()
    await expect(readSessionUserId(visitRequest("theme=dark"))).resolves.toBeNull()
  })

  test("returns null for a token issued with a different secret", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET)
    const token = await encode({ token: { id: "user-1", role: "USER" }, secret: "another-secret-for-forgery-attempts" })

    await expect(readSessionUserId(visitRequest(`next-auth.session-token=${token}`))).resolves.toBeNull()
  })

  test("returns null for garbage cookie values", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", SECRET)

    await expect(readSessionUserId(visitRequest("next-auth.session-token=not-a-jwt"))).resolves.toBeNull()
  })

  test("returns null when no usable auth secret is configured", async () => {
    vi.stubEnv("NEXTAUTH_SECRET", "")
    vi.stubEnv("AUTH_SECRET", "")
    const token = await encode({ token: { id: "user-1", role: "USER" }, secret: SECRET })

    await expect(readSessionUserId(visitRequest(`next-auth.session-token=${token}`))).resolves.toBeNull()
  })
})
