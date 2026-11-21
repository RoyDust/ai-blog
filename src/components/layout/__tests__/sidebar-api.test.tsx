import { render, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";
import { mutate as clearSwrCache } from "swr";
import { Sidebar } from "@/components/layout/Sidebar";
import type { PublicProfile } from "@/lib/public-profile-data";

const sessionState = vi.hoisted(() => ({ status: "unauthenticated" as "authenticated" | "loading" | "unauthenticated" }));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: sessionState.status === "authenticated" ? { user: { id: "user-1" } } : null, status: sessionState.status }),
}));

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

// restoreAllMocks 会清空 setup 里 matchMedia 的 mock 实现（motion 的 useReducedMotion 依赖它），这里重新装上
function restoreMatchMedia() {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function expectReadingStats(container: HTMLElement) {
  const stats = Array.from(container.querySelectorAll("dl > div")).map((item) => [
    item.querySelector("dt")?.textContent,
    item.querySelector("dd")?.textContent,
  ]);
  expect(stats).toEqual([
    ["文章数", "8"],
    ["阅读时长", "2h"],
    ["连续阅读", "3天"],
  ]);
  container.querySelectorAll("dd").forEach((value) => expect(value).toHaveClass("ed-mono"));
}

beforeEach(async () => {
  sessionState.status = "unauthenticated";
  vi.restoreAllMocks();
  restoreMatchMedia();
  await clearSwrCache(() => true, undefined, { revalidate: false });
});

test("sidebar loads categories from the public api route", async () => {
  const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/categories")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: [
              { id: "c1", name: "前端", slug: "frontend", _count: { posts: 3 } },
              { id: "c2", name: "后端", slug: "backend", _count: { posts: 2 } },
              { id: "c3", name: "设计", slug: "design", _count: { posts: 2 } },
              { id: "c4", name: "AI", slug: "ai", _count: { posts: 2 } },
              { id: "c5", name: "生活", slug: "life", _count: { posts: 1 } },
            ],
          }),
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

  const { getByRole, getByTestId, getByText, queryByTestId, container } = render(<Sidebar profile={profile} readingStats={readingStats} />);

  expect(getByTestId("sidebar-categories-skeleton")).toBeInTheDocument();
  expect(getByTestId("sidebar-tags-skeleton")).toBeInTheDocument();
  expect(getByTestId("popular-posts-skeleton")).toBeInTheDocument();

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
    expect(fetchMock).toHaveBeenCalledWith("/api/tags");
    expect(fetchMock).toHaveBeenCalledWith("/api/posts/popular");
  });

  await waitFor(() => {
    expect(getByText("前端")).toBeInTheDocument();
  });
  expect(getByText("后端")).toBeInTheDocument();
  expect(getByText("设计")).toBeInTheDocument();
  expect(getByText("AI")).toBeInTheDocument();
  expect(queryByTestId("sidebar-categories-skeleton")).not.toBeInTheDocument();
  expect(container).not.toHaveTextContent("生活");
  // 分类是「名称 …… 篇数」点线目录行
  const frontendRow = getByRole("link", { name: /前端/ });
  expect(frontendRow).toHaveClass("ed-dotted-row");
  expect(frontendRow).toHaveAttribute("href", "/categories/frontend");
  expect(frontendRow.querySelector(".ed-dotted-row__count")).toHaveTextContent("3");
  expect(getByRole("link", { name: "查看更多分类" })).toHaveAttribute("href", "/categories");
  expect(getByRole("link", { name: "查看更多分类" })).toHaveClass("ed-link");

  // 标签是纯文字 #name
  const tagsList = getByTestId("sidebar-tags-list");
  expect(within(tagsList).getByRole("link", { name: "#React" })).toHaveAttribute("href", "/tags/react");
  expect(within(tagsList).getByRole("link", { name: "#React" })).toHaveClass("ed-tag");
  expect(tagsList.querySelector(".reader-chip")).toBeNull();
  expect(queryByTestId("sidebar-tags-skeleton")).not.toBeInTheDocument();
  expect(getByRole("link", { name: "查看更多标签" })).toHaveAttribute("href", "/tags");

  // 热门：等宽序号 + 标题，浏览量只作为悬停提示
  await waitFor(() => {
    expect(queryByTestId("popular-posts-skeleton")).not.toBeInTheDocument();
  });
  expect(getByRole("heading", { name: "热门" })).toHaveClass("ed-serif");
  expect(getByRole("link", { name: /热门文章标题/ })).toHaveAttribute("href", "/posts/popular-post");
  expect(getByRole("link", { name: /热门文章标题/ })).toHaveAttribute("title", "1,280 次阅读");
  expect(getByText("01")).toHaveClass("ed-mono");

  // 纸面左栏：无面板、随页面自然滚动
  expect(container.querySelector(".reader-panel")).not.toBeInTheDocument();
  expect(container.querySelector('[data-testid="sidebar-taxonomy-rail"]')?.className).not.toContain("sticky");
  expect(getByRole("heading", { name: "RoyDust" })).toBeInTheDocument();
  expect(getByText("后台个人信息驱动的作者资料。")).toBeInTheDocument();
  expect(getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:roy@example.com");
  expect(getByRole("link", { name: "GitHub" })).toHaveAttribute("target", "_blank");
  expect(getByRole("link", { name: "Email" })).not.toHaveAttribute("target");
  expect(getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
  expect(getByRole("heading", { name: "本月阅读目标" })).toBeInTheDocument();
  expectReadingStats(container);
  // 本月目标：等宽「4 / 10 篇」+ 2px 进度线
  expect(getByText("4 / 10 篇")).toHaveClass("ed-mono");
  expect(container.querySelector('[style*="width: 40%"]')).toBeInTheDocument();
});

test("sidebar hides reading data panels when no user stats are provided", () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }),
  );

  const { queryByRole } = render(<Sidebar profile={profile} />);

  expect(queryByRole("heading", { name: "阅读统计" })).not.toBeInTheDocument();
  expect(queryByRole("heading", { name: "本月阅读目标" })).not.toBeInTheDocument();
});

test("sidebar loads reading stats only for authenticated readers", async () => {
  sessionState.status = "authenticated";
  const fetchMock = vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/api/users/me/reading-stats")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            success: true,
            data: readingStats,
          }),
          { status: 200 },
        ),
      );
    }

    return Promise.resolve(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  });

  const { container, getByRole } = render(<Sidebar profile={profile} />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/users/me/reading-stats");
  });

  expect(getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
  expectReadingStats(container);
});

test("sidebar uses SWR keys instead of effect-driven fetch state machines", () => {
  const source = readFileSync(join(process.cwd(), "src/components/layout/Sidebar.tsx"), "utf8");

  expect(source).toContain("useSWR");
  expect(source).toContain("apiFetcher");
  expect(source).not.toContain("useEffect");
  expect(source).not.toContain("fetch(");
});
