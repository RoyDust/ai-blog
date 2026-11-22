import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SWRConfig, mutate as clearSwrCache } from "swr";
import AdminPostsPage from "../posts/page";

function renderPostsPage() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AdminPostsPage />
    </SWRConfig>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

beforeEach(async () => {
  await clearSwrCache(() => true, undefined, { revalidate: false });
});

describe("posts workbench", () => {
  test("renders queue controls, publish shortcuts, and row context", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
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
        ok: true,
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
        ok: true,
        json: async () => ({
          success: true,
          data: { id: "1", published: true },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
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

    const { container } = renderPostsPage();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "AI 内容队列" })).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts?page=1&limit=10");
    expect(screen.getByText("仅看草稿")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "非 AI 日报" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换为已发布" })).toBeInTheDocument();
    expect(screen.getAllByText("评论 2").length).toBeGreaterThan(0);
    expect(screen.getByText("勾选文章后显示批量操作")).toBeInTheDocument();
    // 表头中文：页码与行数不再出现 PAGE/rows 英文残留
    expect(screen.getByText("第 1 / 1 页")).toBeInTheDocument();
    expect(screen.getByText("1 条记录")).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "确认发布文章" })).toBeInTheDocument();
    expect(screen.getByText("发布后立即对读者可见。")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认发布" }));

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
      ok: true,
      json: async () => ({
        success: true,
        data: [],
        pagination: { page: 3, limit: 20, total: 0, totalPages: 1 },
        stats: { total: 0, published: 0, drafts: 0, views: 0 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPostsPage();

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

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("AI Draft")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择 1"));
    fireEvent.click(screen.getByRole("button", { name: "AI 批量补全" }));
    fireEvent.click(screen.getByLabelText(/AI 生成封面/));
    // 自动应用默认关闭，需人工勾选后才写回字段
    fireEvent.click(screen.getByRole("checkbox", { name: /自动应用摘要、SEO 描述和封面/ }));
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
    await waitFor(() => {
      const resumeCall = fetchMock.mock.calls.find(([url]) =>
        String(url).startsWith("/api/admin/ai/batch?resume=1&taskId=task-1"),
      );
      expect(resumeCall?.[1]).toEqual(
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
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

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("Draft Post")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("选择 1"));
    fireEvent.click(screen.getByLabelText("选择 2"));
    fireEvent.click(screen.getByRole("button", { name: "批量发布" }));
    expect(await screen.findByRole("heading", { name: "确认批量发布" })).toBeInTheDocument();
    expect(screen.getByText(/本次将发布 1 篇文章/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "确认批量发布" }));

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

  test("row publish cancel keeps the dialog closed and does not call the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
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
            _count: { comments: 0, likes: 0 },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("Draft Post")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));
    expect(await screen.findByRole("heading", { name: "确认发布文章" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "确认发布文章" })).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/admin/posts/publish")).toBe(false);
  });

  test("switching a published row to draft skips confirmation and calls the API directly", async () => {
    const publishedRow = {
      id: "2",
      title: "Live Post",
      slug: "live-post",
      excerpt: null,
      published: true,
      viewCount: 5,
      createdAt: "2026-04-01T00:00:00Z",
      author: { name: "Admin", email: "admin@example.com" },
      _count: { comments: 1, likes: 2 },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [publishedRow] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { id: "2", published: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [publishedRow] }) });
    vi.stubGlobal("fetch", fetchMock);

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("Live Post")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "切换为草稿" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });
    expect(screen.queryByRole("heading", { name: "确认发布文章" })).not.toBeInTheDocument();

    const draftCall = fetchMock.mock.calls.find(([url]) => url === "/api/admin/posts/publish");
    expect(JSON.parse(String(draftCall?.[1]?.body))).toMatchObject({ id: "2", published: false });
  });

  test("bulk publish dialog shows affected count, highlights >5 posts, and cancel skips the API", async () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({
      id: String(index + 1),
      title: `Draft ${index + 1}`,
      slug: `draft-${index + 1}`,
      excerpt: null,
      published: false,
      viewCount: 0,
      createdAt: "2026-04-01T00:00:00Z",
      author: { name: "Admin", email: "admin@example.com" },
      _count: { comments: 0, likes: 0 },
    }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: rows }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("Draft 1")).toBeInTheDocument();
    });

    for (let index = 1; index <= 6; index += 1) {
      fireEvent.click(screen.getByLabelText(`选择 ${index}`));
    }
    fireEvent.click(screen.getByRole("button", { name: "批量发布" }));

    expect(await screen.findByRole("heading", { name: "确认批量发布" })).toBeInTheDocument();
    expect(screen.getByText(/本次将发布 6 篇文章/)).toBeInTheDocument();
    expect(screen.getByText("本次批量发布超过 5 篇，请再次确认后执行。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "确认批量发布" })).not.toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/admin/posts/publish")).toBe(false);
  });

  test("switches pages client-side without a full page reload", async () => {
    const makeRow = (id: string, title: string) => ({
      id,
      title,
      slug: `draft-${id}`,
      excerpt: null,
      published: false,
      viewCount: 0,
      createdAt: "2026-04-01T00:00:00Z",
      author: { name: "Admin", email: "admin@example.com" },
      _count: { comments: 0, likes: 0 },
    });
    const firstPage = Array.from({ length: 10 }, (_, index) => makeRow(String(index + 1), `Draft ${index + 1}`));
    const secondPage = [makeRow("11", "Draft 11")];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: firstPage,
          pagination: { page: 1, limit: 10, total: 11, totalPages: 2 },
          stats: { total: 11, published: 0, drafts: 11, views: 0 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: secondPage,
          pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
          stats: { total: 11, published: 0, drafts: 11, views: 0 },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    renderPostsPage();

    await waitFor(() => {
      expect(screen.getByText("Draft 1")).toBeInTheDocument();
    });
    expect(screen.getByText("第 1 / 2 页")).toBeInTheDocument();
    expect(screen.getByText("10 条记录")).toBeInTheDocument();
    // 客户端路径渲染为按钮而非链接，翻页不会触发整页刷新
    expect(screen.queryByRole("link", { name: "下一页" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/posts?page=2&limit=10");
    });
    expect(await screen.findByText("Draft 11")).toBeInTheDocument();
    expect(screen.getByText("第 2 / 2 页")).toBeInTheDocument();
    expect(screen.getByText("1 条记录")).toBeInTheDocument();
    // 页面壳仍在原处渲染，未被整页刷新替换
    expect(screen.getByRole("heading", { name: "AI 内容队列" })).toBeInTheDocument();
  });

});
