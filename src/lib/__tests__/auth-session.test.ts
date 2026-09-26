import type { JWT } from "next-auth/jwt"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { findUser } = vi.hoisted(() => ({ findUser: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUser } } }))

import { authOptions } from "@/lib/auth"

const jwtCallback = authOptions.callbacks!.jwt!

// NextAuth omits user on subsequent JWT session reads.
function readToken(token: JWT) {
  return jwtCallback({ token } as Parameters<typeof jwtCallback>[0])
}

describe("current session permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("revokes admin permissions from an already issued token after demotion", async () => {
    findUser.mockResolvedValue({ id: "user-1", role: "USER" })

    const token = await readToken({ id: "user-1", role: "ADMIN", provider: "github" })

    expect(token).toMatchObject({ id: "user-1", role: "USER", provider: "github" })
  })

  test("rejects tokens belonging to deleted users", async () => {
    findUser.mockResolvedValue(null)

    await expect(readToken({ id: "deleted-user", role: "ADMIN" }))
      .rejects.toThrow("Session user no longer exists")
  })

  test("does not fall back to the token role when the database is unavailable", async () => {
    findUser.mockRejectedValue(new Error("Database unavailable"))

    await expect(readToken({ id: "user-1", role: "ADMIN" }))
      .rejects.toThrow("Database unavailable")
  })

  test("allows a current admin and reflects a promotion on the next session read", async () => {
    findUser.mockResolvedValue({ id: "user-1", role: "ADMIN" })

    await expect(readToken({ id: "user-1", role: "USER" }))
      .resolves.toMatchObject({ id: "user-1", role: "ADMIN" })
    await expect(readToken({ id: "user-1", role: "ADMIN" }))
      .resolves.toMatchObject({ id: "user-1", role: "ADMIN" })
  })
})
