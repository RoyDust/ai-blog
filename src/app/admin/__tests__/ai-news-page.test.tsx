import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, test, vi } from "vitest"
import AdminAiNewsPage from "../ai-news/page"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
  },
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("admin AI news page", () => {
  test("triggers daily AI news generation and links to the created post", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            operation: "created",
            published: true,
            sourceCount: 8,
            failures: [],
            post: { id: "post-1", title: "2026-04-29 AI 日报", slug: "ai-daily-2026-04-29", published: true },
            autoReview: { verdict: "ready", score: 91, summary: "质量达标", published: true },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            { id: "run-1", runDate: "2026-04-29T00:00:00.000Z", trigger: "MANUAL", status: "SUCCEEDED", sourceCount: 8, failureCount: 0, postId: "post-1", postTitle: "2026-04-29 AI 日报", postSlug: "ai-daily-2026-04-29", published: true, createdAt: "2026-04-29T08:00:00.000Z" },
          ],
        }),
      })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminAiNewsPage />)

    fireEvent.change(screen.getByLabelText("生成日期"), { target: { value: "2026-04-29" } })
    fireEvent.click(screen.getByRole("button", { name: "生成今日 AI 日报" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai-news/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ date: "2026-04-29" }),
        }),
      )
    })

    expect(await screen.findByText("2026-04-29 AI 日报")).toBeInTheDocument()
    expect(screen.getByText("候选新闻 8 条")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "编辑文章" })).toHaveAttribute("href", "/admin/posts/post-1/edit")
    expect(screen.getByRole("link", { name: "查看前台" })).toHaveAttribute("href", "/posts/ai-daily-2026-04-29")
  })

  test("renders recent run history with failure reasons", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          {
            id: "run-failed",
            runDate: "2026-04-29T00:00:00.000Z",
            trigger: "CRON",
            status: "FAILED",
            sourceCount: 0,
            failureCount: 4,
            error: "No AI news candidates available",
            published: false,
            createdAt: "2026-04-29T01:00:00.000Z",
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminAiNewsPage />)

    expect(await screen.findByRole("heading", { name: "运行记录" })).toBeInTheDocument()
    expect(await screen.findByText("生成失败")).toBeInTheDocument()
    expect(await screen.findByText("No AI news candidates available")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-news/run")
  })
})
