import { render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

test("header includes /guides in primary navigation", () => {
  render(<Header siteName="Inkforge" />);

  const primaryNav = screen.getByRole("navigation", { name: "Primary" });
  expect(within(primaryNav).getByRole("link", { name: "专题" })).toHaveAttribute("href", "/guides");
});

test("sidebar and footer expose discovery-oriented public chrome", () => {
  const fetchMock = vi.fn(() =>
    Promise.resolve({
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

    expect(container.querySelector("#footer .reader-panel")).toBeInTheDocument();
    expect(container.querySelector("#sidebar .reader-panel")).toBeInTheDocument();

    const footerNav = screen.getByRole("navigation", { name: "Footer" });
    const footerLinks = within(footerNav).getAllByRole("link");
    expect(footerLinks.map((link) => link.getAttribute("href"))).toEqual([
      "/posts",
      "/series",
      "/guides",
      "/categories",
      "/archives",
      "/rss.xml",
    ]);

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
