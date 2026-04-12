import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AdminPostsPage from "../posts/page";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin density", () => {
  test("posts queue keeps primary creation action and active queue filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          success: true,
          data: [
            {
              id: "1",
              title: "Post 1",
              slug: "post-1",
              published: false,
              viewCount: 10,
              createdAt: "2026-01-01T00:00:00Z",
              author: { name: "Admin", email: "admin@example.com" },
              _count: { comments: 0, likes: 0 },
            },
          ],
        }),
      }),
    );

    render(<AdminPostsPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "内容队列" })).toBeInTheDocument();
    });

    expect(screen.getByRole("link", { name: "新建文章" })).toHaveAttribute("href", "/admin/posts/new");
    expect(screen.getByRole("button", { name: "全部内容" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "仅看草稿" })).toBeInTheDocument();
    expect(screen.getByText("共 1 篇内容")).toBeInTheDocument();
  });
});
