import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Sidebar } from "@/components/layout/Sidebar";
import type { PublicProfile } from "@/lib/public-profile-data";

const profile: PublicProfile = {
  name: "RoyDust",
  initials: "RD",
  avatar: "https://example.com/avatar.png",
  email: "roy@example.com",
  subtitle: "专注前端开发与工程实践",
  tagline: "内容创作 / 前端体验 / 开源实践",
  bio: "后台个人信息驱动的作者资料。",
  intro: "个人介绍",
  links: [
    { kind: "github", name: "GitHub", url: "https://github.com/RoyDust" },
    { kind: "email", name: "Email", url: "mailto:roy@example.com" },
  ],
};

const readingStats = {
  totalArticles: 8,
  totalReadingMinutes: 125,
  streakDays: 3,
  monthlyRead: 4,
  monthlyGoal: 10,
  monthlyProgress: 40,
};

test("sidebar loads categories from the public api route", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/categories")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: [{ id: "c1", name: "前端", slug: "frontend", _count: { posts: 3 } }] }),
          { status: 200 }
        )
      );
    }
    if (url.endsWith("/api/tags")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: [{ id: "t1", name: "React", slug: "react", color: null, _count: { posts: 2 } }] }),
          { status: 200 }
        )
      );
    }
    if (url.endsWith("/api/posts/popular")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({ success: true, data: [{ id: "p1", title: "热门文章标题", slug: "popular-post", viewCount: 1280 }] }),
          { status: 200 }
        )
      );
    }
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const { getByRole, getByText, container } = render(<Sidebar profile={profile} readingStats={readingStats} />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/posts/popular");
  });

  expect(getByText("前端")).toBeInTheDocument();
  expect(getByText("React")).toBeInTheDocument();
  expect(getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
  expect(getByRole("link", { name: /热门文章标题/ })).toHaveAttribute("href", "/posts/popular-post");
  expect(getByText("1,280")).toBeInTheDocument();
  expect(container.querySelector(".reader-panel")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="sidebar-taxonomy-rail"]')?.className).toContain("sticky");
  expect(getByRole("heading", { name: "RoyDust" })).toBeInTheDocument();
  expect(getByText("后台个人信息驱动的作者资料。")).toBeInTheDocument();
  expect(getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:roy@example.com");
  expect(getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
  expect(getByRole("heading", { name: "本月阅读目标" })).toBeInTheDocument();
  expect(getByText("8")).toBeInTheDocument();
  expect(getByText("2h")).toBeInTheDocument();
  expect(getByText("3天")).toBeInTheDocument();
  expect(getByText("40%")).toBeInTheDocument();

  fetchMock.mockRestore();
});

test("sidebar hides reading data panels when no user stats are provided", () => {
  const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
  );

  const { queryByRole } = render(<Sidebar profile={profile} />);

  expect(queryByRole("heading", { name: "阅读统计" })).not.toBeInTheDocument();
  expect(queryByRole("heading", { name: "本月阅读目标" })).not.toBeInTheDocument();

  fetchMock.mockRestore();
});
