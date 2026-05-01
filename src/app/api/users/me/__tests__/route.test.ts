import { beforeEach, describe, expect, test, vi } from "vitest"

const getServerSession = vi.fn()
const findFirst = vi.fn()
const update = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst,
      update,
    },
  },
}))

describe("PATCH /api/users/me", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns conflict when email is already used by another account", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findFirst.mockResolvedValueOnce({ id: "user-2", email: "taken@example.com" })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "User", email: "taken@example.com" }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(409)
    expect(payload).toEqual({ error: "Email already in use" })
    expect(update).not.toHaveBeenCalled()
  })

  test("updates profile image with the current user profile", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    findFirst.mockResolvedValueOnce(null)
    update.mockResolvedValueOnce({ id: "user-1", name: "Roy", email: "roy@example.com", image: "https://example.com/avatar.png" })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Roy", email: "roy@example.com", image: "https://example.com/avatar.png" }),
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
      },
    })
    expect(payload.data.image).toBe("https://example.com/avatar.png")
  })
})
