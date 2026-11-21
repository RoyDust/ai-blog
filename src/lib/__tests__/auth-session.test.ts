import type { JWT } from "next-auth/jwt"
import { beforeEach, describe, expect, test, vi } from "vitest"

const { findUser } = vi.hoisted(() => ({ findUser: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUser } } }))

import { authOptions } from "@/lib/auth"

const jwtCallback = authOptions.callbacks!.jwt!
const sessionCallback = authOptions.callbacks!.session!

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

  test("syncs updated name, email, and image from database into JWT and session.user on session refresh", async () => {
    findUser.mockResolvedValueOnce({
      role: "ADMIN",
      name: "新名字",
      email: "updated@example.com",
      image: "https://example.com/updated-avatar.png",
    })

    const nextToken = await readToken({
      id: "user-1",
      role: "ADMIN",
      name: "旧名字",
      email: "old@example.com",
      picture: "https://example.com/old-avatar.png",
      provider: "credentials",
    })

    expect(findUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        role: true,
        name: true,
        email: true,
        image: true,
      },
    })
    expect(nextToken).toMatchObject({
      id: "user-1",
      role: "ADMIN",
      name: "新名字",
      email: "updated@example.com",
      picture: "https://example.com/updated-avatar.png",
    })

    const session = await sessionCallback({
      session: {
        expires: "2026-12-31T00:00:00.000Z",
        user: {
          id: "user-1",
          role: "USER",
          name: "旧名字",
          email: "old@example.com",
          image: "https://example.com/old-avatar.png",
        },
      },
      token: nextToken,
    } as Parameters<typeof sessionCallback>[0])

    expect(session.user).toEqual({
      id: "user-1",
      role: "ADMIN",
      provider: "credentials",
      name: "新名字",
      email: "updated@example.com",
      image: "https://example.com/updated-avatar.png",
    })

    // 清除头像（image: null）也立即同步到 session.user.image
    findUser.mockResolvedValueOnce({
      role: "ADMIN",
      name: "新名字",
      email: "updated@example.com",
      image: null,
    })
    const clearedToken = await readToken(nextToken)
    const clearedSession = await sessionCallback({
      session,
      token: clearedToken,
    } as Parameters<typeof sessionCallback>[0])
    expect(clearedSession.user?.image).toBeNull()
  })
})
