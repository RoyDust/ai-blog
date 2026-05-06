import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminPostsPage from "../posts/page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("posts workbench", () => {
  test("renders queue controls, publish shortcuts, and row context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "AI Draft",
              slug: "ai-draft",
              excerpt: null,
              published: false,
              viewCount: 3,
              createdAt: "2026-04-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 2, likes: 5 },
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: { id: "1", published: true },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "内容队列" })).toBeInTheDocument();
    });

    expect(screen.getByText("仅看草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换为已发布" })).toBeInTheDocument();
    expect(screen.getByText("评论 2")).toBeInTheDocument();
    expect(screen.getByText("支持批量 AI 摘要、封面生成、内容补全、隐藏与状态切换")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });
  });

  test("opens AI batch completion for selected posts", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/admin/ai/batch" && (options as { method?: string } | undefined)?.method === "POST") {
        return {
          ok: true,
          json: async () => ({ success: true, data: { id: "task-1", items: [{ id: "item-1" }] } }),
        };
      }

      if (String(url).startsWith("/api/admin/ai/batch?resume=1") || String(url).startsWith("/api/admin/posts/summarize/bulk?resume=1")) {
        return { ok: true, json: async () => ({ success: true }) };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "AI Draft",
              slug: "ai-draft",
              excerpt: null,
              summaryStatus: "EMPTY",
              summaryError: null,
              summaryGeneratedAt: null,
              summaryJobId: null,
              published: false,
              viewCount: 3,
              createdAt: "2026-04-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 2, likes: 5 },
            },
          ],
        }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByText("AI Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择 1"));
    fireEvent.click(screen.getByRole("button", { name: "AI 批量补全" }));
    fireEvent.click(screen.getByLabelText(/AI 生成封面/));
    fireEvent.click(screen.getByRole("button", { name: "开始补全" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url]) => url === "/api/admin/ai/batch")).toBe(true);
    });
    const bulkCall = fetchMock.mock.calls.find(([url]) => url === "/api/admin/ai/batch");
    expect(JSON.parse(String(bulkCall?.[1]?.body))).toMatchObject({
      postIds: ["1"],
      actions: ["summary", "seo-description", "cover-image"],
      mode: "missing-only",
      apply: true,
    });
    expect(await screen.findByText("查看详情")).toHaveAttribute("href", "/admin/ai/tasks/task-1");
  });
});
