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

const modelPayload = [
  {
    id: "model-1",
    name: "日报模型",
    description: "AI 日报生成模型",
    provider: "openai-compatible",
    baseUrl: "https://example.com/v1",
    requestPath: "/chat/completions",
    model: "qwen-news",
    apiKeyEnv: "database",
    baseUrlEnv: "database",
    modelEnv: "database",
    capabilities: ["post-summary"],
    defaultFor: ["post-summary"],
    source: "database",
    editable: true,
    deletable: true,
    enabled: true,
    status: "ready",
    hasApiKey: true,
    lastTestStatus: null,
    lastTestMessage: null,
  },
]

function jsonResponse(data: unknown) {
  return {
    ok: true,
    json: async () => data,
  }
}

describe("admin AI news page", () => {
  test("triggers daily AI news generation and links to the created post", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "/api/admin/ai/models") {
        return Promise.resolve(jsonResponse({ success: true, data: modelPayload }))
      }

      if (url === "/api/admin/ai-news/run" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({
          success: true,
          data: {
            operation: "created",
            published: true,
            sourceCount: 8,
            failures: [],
            generatedBy: { id: "model-1", name: "日报模型", model: "qwen-news" },
            post: { id: "post-1", title: "2026-04-29 AI 日报", slug: "ai-daily-2026-04-29", published: true },
            autoReview: { verdict: "ready", score: 91, summary: "质量达标", published: true },
          },
        }))
      }

      if (url === "/api/admin/ai-news/run") {
        return Promise.resolve(jsonResponse({
          success: true,
          data: [
            { id: "run-1", runDate: "2026-04-29T00:00:00.000Z", trigger: "MANUAL", status: "SUCCEEDED", sourceCount: 8, failureCount: 0, postId: "post-1", postTitle: "2026-04-29 AI 日报", postSlug: "ai-daily-2026-04-29", published: true, createdAt: "2026-04-29T08:00:00.000Z" },
          ],
        }))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminAiNewsPage />)

    expect(await screen.findByText("当前模型：日报模型（qwen-news）。")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("生成日期"), { target: { value: "2026-04-29" } })
    fireEvent.click(screen.getByRole("button", { name: "生成今日 AI 日报" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai-news/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
        }),
      )
    })

    expect(await screen.findByText("2026-04-29 AI 日报")).toBeInTheDocument()
    expect(screen.getByText("候选新闻 8 条")).toBeInTheDocument()
    expect(screen.getAllByText("生成模型 日报模型（qwen-news）").length).toBeGreaterThan(0)
    expect(screen.getByRole("link", { name: "编辑文章" })).toHaveAttribute("href", "/admin/posts/post-1/edit")
    expect(screen.getByRole("link", { name: "查看前台" })).toHaveAttribute("href", "/posts/ai-daily-2026-04-29")
  })

  test("requests regeneration for an existing daily AI news post", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "/api/admin/ai/models") {
        return Promise.resolve(jsonResponse({ success: true, data: modelPayload }))
      }

      if (url === "/api/admin/ai-news/run" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({
          success: true,
          data: {
            operation: "regenerated",
            published: true,
            sourceCount: 8,
            failures: [],
            generatedBy: { id: "model-1", name: "日报模型", model: "qwen-news" },
            post: { id: "post-1", title: "2026-04-29 AI 日报：重新生成", slug: "ai-daily-2026-04-29", published: true },
            autoReview: { verdict: "ready", score: 93, summary: "质量达标", published: true },
          },
        }))
      }

      if (url === "/api/admin/ai-news/run") {
        return Promise.resolve(jsonResponse({ success: true, data: [] }))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminAiNewsPage />)

    expect(await screen.findByText("当前模型：日报模型（qwen-news）。")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("生成日期"), { target: { value: "2026-04-29" } })
    fireEvent.click(screen.getByRole("button", { name: "重新生成今日日报" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai-news/run",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ date: "2026-04-29", modelId: "model-1", regenerate: true }),
        }),
      )
    })

    expect(await screen.findByText("2026-04-29 AI 日报：重新生成")).toBeInTheDocument()
    expect(screen.getByText("生成模型 日报模型（qwen-news）")).toBeInTheDocument()
  })

  test("renders recent run history with failure reasons", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input)

      if (url === "/api/admin/ai/models") {
        return Promise.resolve(jsonResponse({ success: true, data: modelPayload }))
      }

      if (url === "/api/admin/ai-news/run") {
        return Promise.resolve(jsonResponse({
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
        }))
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`))
    })
    vi.stubGlobal("fetch", fetchMock)

    render(<AdminAiNewsPage />)

    expect(await screen.findByRole("heading", { name: "运行记录" })).toBeInTheDocument()
    expect(await screen.findByText("生成失败")).toBeInTheDocument()
    expect(await screen.findByText("No AI news candidates available")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/ai-news/run")
  })
})
