import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminPostsPage from "../posts/page";

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
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
      })
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "AI Draft",
              slug: "ai-draft",
              excerpt: null,
              published: true,
              viewCount: 3,
              createdAt: "2026-04-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 2, likes: 5 },
            },
          ],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 内容队列" })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts?page=1&limit=10");
    expect(screen.getByText("仅看草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "非 AI 日报" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换为已发布" })).toBeInTheDocument();
    expect(screen.getAllByText("评论 2").length).toBeGreaterThan(0);
    expect(screen.getByText("勾选文章后显示批量操作")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量发布" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量转草稿" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "批量删除" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "预览" })).toHaveAttribute("href", "/admin/posts/preview/ai-draft");
    expect(container.firstElementChild).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(screen.getByTestId("admin-data-table-scroll")).toHaveClass("min-h-0", "flex-1", "overflow-auto");

    fireEvent.click(screen.getByRole("button", { name: "非 AI 日报" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts?page=1&limit=10&type=non-ai-daily");
    });

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });
  });

  test("restores cached filters after refresh before loading posts", async () => {
    window.localStorage.setItem(
      "admin:posts:list-filters",
      JSON.stringify({
        query: "gateway",
        statusFilter: "published",
        contentTypeFilter: "non-ai-daily",
        page: 3,
        pageSize: 20,
      }),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 3, limit: 20, total: 0, totalPages: 1 },
        stats: { total: 0, published: 0, drafts: 0, views: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts?page=3&limit=20&q=gateway&status=published&type=non-ai-daily");
    });
    expect(fetchMock).not.toHaveBeenCalledWith("/api/admin/posts?page=1&limit=10");
    expect(screen.getByLabelText("搜索文章")).toHaveValue("gateway");
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

  test("batch publishes selected draft posts without republishing already published rows", async () => {
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({ success: true, data: { count: 1 } }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "Draft Post",
              slug: "draft-post",
              excerpt: null,
              published: false,
              viewCount: 3,
              createdAt: "2026-04-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 2, likes: 5 },
            },
            {
              id: "2",
              title: "Published Post",
              slug: "published-post",
              excerpt: "摘要",
              published: true,
              viewCount: 8,
              createdAt: "2026-04-02T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 0, likes: 1 },
            },
          ],
        }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByText("Draft Post")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择 1"));
    fireEvent.click(screen.getByLabelText("选择 2"));
    fireEvent.click(screen.getByRole("button", { name: "批量发布" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });

    const publishCall = fetchMock.mock.calls.find(([url]) => url === "/api/admin/posts/publish");
    expect(JSON.parse(String(publishCall?.[1]?.body))).toMatchObject({
      ids: ["1"],
      published: true,
    });
  });
});
