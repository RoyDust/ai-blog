import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

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
    expect(screen.getByRole("navigation", { name: "Footer" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "My Blog" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分类" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "本月阅读目标" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "继续探索" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "标签地图" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "快捷导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
