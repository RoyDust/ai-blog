import type { CredentialsConfig } from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const { findUser, queryRaw } = vi.hoisted(() => ({ findUser: vi.fn(), queryRaw: vi.fn() }))
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: findUser }, $queryRawUnsafe: queryRaw },
}))

const password = bcrypt.hashSync("valid-password", 4)

async function login(ip = "203.0.113.42", attempt = "wrong-password") {
  const { authOptions } = await import("@/lib/auth")
  const provider = authOptions.providers.find((item) => item.id === "credentials") as CredentialsConfig
  const authorize = provider.options?.authorize
  if (!authorize) throw new Error("Credentials provider is missing")
  return authorize(
    { email: "admin@example.com", password: attempt },
    { headers: { "x-forwarded-for": ip }, method: "POST", body: {}, query: {} },
  )
}

describe("password login throttling", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv("RATE_LIMIT_DRIVER", "memory")
    findUser.mockResolvedValue({ id: "admin-1", email: "admin@example.com", role: "ADMIN", password })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test("blocks the sixth attempt from one IP before checking the account or password", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(login()).rejects.toThrow("Invalid credentials")
    }

    await expect(login()).rejects.toThrow("Too many requests")
    expect(findUser).toHaveBeenCalledTimes(5)
  })

  test("allows another IP and allows the blocked IP again after the window expires", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(login()).rejects.toThrow("Invalid credentials")
    }
    await expect(login(undefined, "valid-password")).rejects.toThrow("Too many requests")
    await expect(login("203.0.113.43", "valid-password")).resolves.toMatchObject({ id: "admin-1" })
    now.mockReturnValue(1_060_000)
    await expect(login(undefined, "valid-password")).resolves.toMatchObject({ id: "admin-1" })
  })

  test("honors the database limit shared by production instances", async () => {
    vi.stubEnv("RATE_LIMIT_DRIVER", "database")
    queryRaw.mockResolvedValue([{ count: 6, reset_at: new Date(Date.now() + 60_000) }])

    await expect(login(undefined, "valid-password")).rejects.toThrow("Too many requests")
    expect(findUser).not.toHaveBeenCalled()
  })

  test("does not bypass throttling when the shared database limiter is unavailable", async () => {
    vi.stubEnv("RATE_LIMIT_DRIVER", "database")
    queryRaw.mockRejectedValue(new Error("Rate limit database unavailable"))

    await expect(login(undefined, "valid-password")).rejects.toThrow("Rate limit database unavailable")
    expect(findUser).not.toHaveBeenCalled()
  })
})
