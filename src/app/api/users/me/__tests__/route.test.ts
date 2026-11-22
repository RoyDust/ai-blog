import bcrypt from "bcryptjs"
import { beforeEach, describe, expect, test, vi } from "vitest"

const getServerSession = vi.fn()
const findUnique = vi.fn()
const findFirst = vi.fn()
const update = vi.fn()
const revalidateBlogSettings = vi.fn()
const passwordHash = bcrypt.hashSync("correct-password", 4)

vi.mock("next-auth", () => ({
  getServerSession,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique,
      findFirst,
      update,
    },
  },
}))

vi.mock("@/lib/cache", () => ({
  revalidateBlogSettings,
}))

describe("PATCH /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns conflict when new email is already used by another account (case-insensitive)", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "user1@example.com",
      password: passwordHash,
      role: "USER",
    })
    findFirst.mockResolvedValueOnce({ id: "user-2", email: "Taken@Example.com" })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "User",
          email: "  TAKEN@example.com ",
          currentPassword: "correct-password",
        }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({ error: "Email already in use" })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        email: { equals: "taken@example.com", mode: "insensitive" },
        NOT: { id: "user-1" },
      },
    })
    expect(update).not.toHaveBeenCalled()
    expect(revalidateBlogSettings).not.toHaveBeenCalled()
  })

  test("rejects email change for OAuth-only account without local password", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "oauth-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "oauth-1",
      email: "github@example.com",
      password: null,
      role: "USER",
    })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "OAuth User",
          email: "new@example.com",
          currentPassword: "any-password",
        }),
      }),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "第三方登录账号暂不支持直接更换登录邮箱" })
    expect(findFirst).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  test("requires non-empty and valid currentPassword when changing email, and resets emailVerified on success", async () => {
    const { PATCH } = await import("../route")

    // 缺少密码
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "old@example.com",
      password: passwordHash,
      role: "USER",
    })
    const missingPwdRes = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "User", email: "new@example.com" }),
      }),
    )
    expect(missingPwdRes.status).toBe(400)
    expect(await missingPwdRes.json()).toEqual({ error: "修改登录邮箱需验证当前登录密码" })

    // 密码错误
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "old@example.com",
      password: passwordHash,
      role: "USER",
    })
    const wrongPwdRes = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "User",
          email: "new@example.com",
          currentPassword: "wrong-password",
        }),
      }),
    )
    expect(wrongPwdRes.status).toBe(400)
    expect(await wrongPwdRes.json()).toEqual({ error: "当前登录密码不正确" })
    expect(update).not.toHaveBeenCalled()

    // 密码正确：归一化小写邮箱并重置 emailVerified: null
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "old@example.com",
      password: passwordHash,
      role: "USER",
    })
    findFirst.mockResolvedValueOnce(null)
    update.mockResolvedValueOnce({
      id: "user-1",
      name: "User",
      email: "new@example.com",
      image: null,
      role: "USER",
    })

    const okRes = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "User",
          email: "  New@Example.COM ",
          image: null,
          currentPassword: "correct-password",
        }),
      }),
    )

    expect(okRes.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        name: "User",
        email: "new@example.com",
        image: null,
        emailVerified: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    })
  })

  test("updates profile name and image without requiring currentPassword when email is unchanged", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findUnique.mockResolvedValueOnce({
      id: "user-1",
      email: "roy@example.com",
      password: passwordHash,
      role: "USER",
    })
    findFirst.mockResolvedValueOnce(null)
    update.mockResolvedValueOnce({
      id: "user-1",
      name: "Roy",
      email: "roy@example.com",
      image: "https://example.com/avatar.png",
      role: "USER",
    })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Roy", email: "  ROY@example.com ", image: "https://example.com/avatar.png" }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { name: "Roy", email: "roy@example.com", image: "https://example.com/avatar.png" },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
      },
    })
    expect(payload.data.image).toBe("https://example.com/avatar.png")
    expect(payload.data.role).toBeUndefined()
    expect(revalidateBlogSettings).not.toHaveBeenCalled()
  })

  test("revalidates public settings when an admin profile changes", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    findUnique.mockResolvedValueOnce({
      id: "admin-1",
      email: "admin@example.com",
      password: passwordHash,
      role: "ADMIN",
    })
    findFirst.mockResolvedValueOnce(null)
    update.mockResolvedValueOnce({ id: "admin-1", name: "Admin", email: "admin@example.com", image: null, role: "ADMIN" })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Admin", email: "admin@example.com", image: null }),
      }),
    )

    expect(response.status).toBe(200)
    expect(revalidateBlogSettings).toHaveBeenCalledOnce()
  })
})
