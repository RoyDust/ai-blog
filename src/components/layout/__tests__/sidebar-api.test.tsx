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
    return Promise.reject(new Error(`Unexpected URL: ${url}`));
  });

  const { getByRole, getByText, container } = render(<Sidebar profile={profile} />);

  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/api/categories");
  });

  expect(getByText("前端")).toBeInTheDocument();
  expect(container.querySelector(".reader-panel")).toBeInTheDocument();
  expect(container.querySelector('[data-testid="sidebar-taxonomy-rail"]')?.className).toContain("sticky");
  expect(getByRole("heading", { name: "RoyDust" })).toBeInTheDocument();
  expect(getByText("后台个人信息驱动的作者资料。")).toBeInTheDocument();
  expect(getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:roy@example.com");
  expect(getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
  expect(getByRole("heading", { name: "本月阅读目标" })).toBeInTheDocument();

  fetchMock.mockRestore();
});
