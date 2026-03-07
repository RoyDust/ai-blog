import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, test } from "vitest"
import { BookmarkShelfItem } from "../BookmarkShelfItem"

afterEach(() => {
  cleanup()
})

const post = {
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
}

test("renders a premium archive-style bookmark item", () => {
  const { container } = render(<BookmarkShelfItem post={post} />)

  expect(screen.getByText("Design")).toBeInTheDocument()
  expect(screen.getByText("已留存")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: /Designing Quiet Interfaces/i })).toBeInTheDocument()
  expect(screen.getByText("A case for low-noise interaction patterns.")).toBeInTheDocument()
  expect(screen.getByRole("link", { name: "打开文章" })).toHaveAttribute("href", "/posts/quiet-interfaces")
  expect(container).toHaveTextContent("4 评论")
})
