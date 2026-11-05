import { act, render, screen } from "@testing-library/react"
import React from "react"
import { beforeEach, describe, expect, test } from "vitest"

describe("bookmarks page", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test("renders a local library-style bookmarks archive", async () => {
    window.localStorage.setItem(
      'local-bookmarks',
      JSON.stringify([
        {
          slug: 'quiet-interfaces',
          title: 'Designing Quiet Interfaces',
          excerpt: 'A case for low-noise interaction patterns.',
          createdAt: '2026-03-08T00:00:00.000Z',
        },
      ])
    )

    const { default: BookmarksPage } = await import("../page")
    const { container } = render(<BookmarksPage />)

    expect(screen.getByRole("heading", { name: "我的收藏" })).toBeInTheDocument()
    expect(screen.getByText("留下一些值得反复阅读的内容。")).toBeInTheDocument()
    expect(screen.getByText("已收藏 01 篇")).toBeInTheDocument()
    expect(container.querySelector("[data-bookmark-shelf='true']")).not.toBeNull()
    expect(screen.getByRole("link", { name: /Designing Quiet Interfaces/i })).toHaveAttribute("href", "/posts/quiet-interfaces")

    // 报头 + 全站列表行：等宽序号、衬线标题，不再是卡片
    expect(screen.getByText("收藏", { selector: ".ed-eyebrow" })).toBeInTheDocument()
    expect(container.querySelector("hr.ed-rule-strong")).toBeInTheDocument()
    const row = screen.getByTestId("post-list-row")
    expect(row).toHaveClass("ed-row")
    expect(row.querySelector(".ed-row__index")).toHaveTextContent("01")
    expect(container.querySelector(".card-base, .rounded-full")).toBeNull()
  })

  test("follows bookmark changes from other tabs", async () => {
    const { default: BookmarksPage } = await import("../page")
    render(<BookmarksPage />)

    expect(screen.getByText("已收藏 00 篇")).toBeInTheDocument()

    act(() => {
      window.localStorage.setItem(
        "local-bookmarks",
        JSON.stringify([{ slug: "later", title: "Read Later", createdAt: "2026-03-09T00:00:00.000Z" }])
      )
      window.dispatchEvent(new Event("bookmarks:changed"))
    })

    expect(await screen.findByText("已收藏 01 篇")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Read Later" })).toBeInTheDocument()
  })

  test("renders a refined empty state linking to posts", async () => {
    const { default: BookmarksPage } = await import("../page")
    render(<BookmarksPage />)

    expect(screen.getByText("这里还没有留下任何内容")).toBeInTheDocument()
    expect(screen.getByText("当你收藏一篇文章，它会安静地留在这里。")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "去看看文章" })).toHaveAttribute("href", "/posts")
    expect(screen.getByText("这里还没有留下任何内容")).toHaveClass("ed-empty__title")
  })
})
