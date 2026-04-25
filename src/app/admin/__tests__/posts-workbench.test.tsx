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
    expect(screen.getByText("支持批量 AI 摘要、隐藏与状态切换")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });
  });

  test("runs AI summary generation for selected posts", async () => {
    let postListLoads = 0;
    const fetchMock = vi.fn(async (url, options) => {
      if (url === "/api/admin/posts/summarize/bulk" && (options as { method?: string } | undefined)?.method === "POST") {
        return {
          json: async () => ({
            success: true,
            data: {
              jobId: "job-1",
              requested: 1,
              queued: 1,
              failed: 0,
              status: "queued",
              results: [{ id: "1", status: "queued" }],
            },
          }),
        };
      }

      if (String(url).startsWith("/api/admin/posts/summarize/bulk?resume=1")) {
        return {
          json: async () => ({
            success: true,
            data: { active: false, counts: { GENERATED: 1 }, posts: [] },
          }),
        };
      }

      postListLoads += 1;
      return {
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "AI Draft",
              slug: "ai-draft",
              excerpt: postListLoads > 1 ? "生成后的摘要。" : null,
              summaryStatus: postListLoads > 1 ? "GENERATED" : "EMPTY",
              summaryError: null,
              summaryGeneratedAt: postListLoads > 1 ? "2026-04-01T00:00:00Z" : null,
              summaryJobId: postListLoads > 1 ? "job-1" : null,
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
    fireEvent.click(screen.getByRole("button", { name: "AI 生成摘要" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) =>
            url === "/api/admin/posts/summarize/bulk" &&
            (options as { method?: string } | undefined)?.method === "POST",
        ),
      ).toBe(true);
    });
    const bulkCall = fetchMock.mock.calls.find(
      ([url, options]) =>
        url === "/api/admin/posts/summarize/bulk" &&
        (options as { method?: string } | undefined)?.method === "POST",
    );
    expect(JSON.parse(String(bulkCall?.[1]?.body))).toEqual({ ids: ["1"] });

    await waitFor(() => {
      expect(screen.getByText("生成后的摘要。")).toBeInTheDocument();
    });
  });
});
