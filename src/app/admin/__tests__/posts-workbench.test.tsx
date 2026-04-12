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
    expect(screen.getByText("支持批量隐藏与状态切换")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "切换为已发布" }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) => url === "/api/admin/posts/publish" && (options as { method?: string } | undefined)?.method === "PATCH",
        ),
      ).toBe(true);
    });
  });
});
