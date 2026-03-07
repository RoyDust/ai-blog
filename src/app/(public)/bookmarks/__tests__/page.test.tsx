import { render, screen } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, test, vi } from "vitest"

const getServerSession = vi.fn()
const findMany = vi.fn()
const redirect = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession,
}))

vi.mock("next/navigation", () => ({
  redirect,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    bookmark: {
      findMany,
    },
  },
}))

describe("bookmarks page", () => {
  beforeEach(() => {
    getServerSession.mockReset()
    findMany.mockReset()
    redirect.mockReset()
  })

  test("renders a library-style bookmarks archive", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } })
    findMany.mockResolvedValue([
      {
        post: {
          id: "post-1",
          title: "Designing Quiet Interfaces",
          slug: "quiet-interfaces",
          excerpt: "A case for low-noise interaction patterns.",
          coverImage: null,
          createdAt: new Date("2026-03-08T00:00:00Z"),
          author: { id: "author-1", name: "Ada", image: null },
          category: { name: "Design", slug: "design" },
          tags: [{ name: "UX", slug: "ux" }],
          _count: { comments: 4, likes: 9 },
        },
      },
    ])

    const { default: BookmarksPage } = await import("../page")
    const ui = await BookmarksPage()
    const { container } = render(ui as React.ReactElement)

    expect(screen.getByRole("heading", { name: "我的收藏" })).toBeInTheDocument()
    expect(screen.getByText("留下一些值得反复阅读的内容。"))
      .toBeInTheDocument()
    expect(screen.getByText("已收藏 01 篇"))
      .toBeInTheDocument()
    expect(container.querySelector("[data-bookmark-shelf='true']")).not.toBeNull()
    expect(screen.getByRole("link", { name: /Designing Quiet Interfaces/i })).toBeInTheDocument()
  })

  test("renders a refined empty state linking to posts", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } })
    findMany.mockResolvedValue([])

    const { default: BookmarksPage } = await import("../page")
    const ui = await BookmarksPage()
    render(ui as React.ReactElement)

    expect(screen.getByText("这里还没有留下任何内容")).toBeInTheDocument()
    expect(screen.getByText("当你收藏一篇文章，它会安静地留在这里。")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "去看看文章" })).toHaveAttribute("href", "/posts")
  })
})
