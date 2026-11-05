import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

test("sidebar and footer expose discovery-oriented public chrome", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as Response),
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;

  try {
    const { container } = render(
      <>
        <Sidebar />
        <Footer />
      </>,
    );

    // 方向 A：侧栏与页脚直接落在纸面上，没有面板 / 卡片
    expect(container.querySelector("#footer .reader-panel")).not.toBeInTheDocument();
    expect(container.querySelector("#sidebar .reader-panel")).not.toBeInTheDocument();
    expect(container.querySelector("#sidebar .reader-card")).not.toBeInTheDocument();
    expect(container.querySelector("#footer")).toHaveClass("border-t", "border-[var(--border)]");

    // 页脚：纯文字链接，· 分隔，无图标
    const footerNav = screen.getByRole("navigation", { name: "Footer" });
    const footerLinks = within(footerNav).getAllByRole("link");
    expect(footerLinks.map((link) => link.getAttribute("href"))).toEqual(["/posts", "/series", "/categories", "/archives", "/rss.xml"]);
    expect(footerNav.querySelector("svg")).toBeNull();
    expect(within(footerNav).getAllByText("·")).toHaveLength(footerLinks.length - 1);
    expect(screen.getByText("My Blog")).toBeInTheDocument();

    // 侧栏组标题用衬线体
    expect(screen.getByRole("heading", { name: "分类" })).toHaveClass("ed-serif");
    expect(screen.getByRole("heading", { name: "标签" })).toHaveClass("ed-serif");
    expect(screen.getByRole("link", { name: "RSS 订阅源" })).toHaveClass("ed-icon-btn");
    expect(screen.getByRole("heading", { name: "Inkforge Author" })).toBeInTheDocument();
    expect(container.querySelector('#sidebar a[href=""]')).not.toBeInTheDocument();
    expect(container.querySelector('#sidebar a[href="mailto:null"]')).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分类" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "阅读统计" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "本月阅读目标" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "继续探索" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "标签地图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "快捷导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
