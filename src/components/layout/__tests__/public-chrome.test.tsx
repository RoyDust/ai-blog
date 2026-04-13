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

    expect(container.querySelectorAll(".card-base").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "继续探索" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分类索引" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "标签地图" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "快捷导航" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /文章归档/i })).toHaveAttribute("href", "/archives");
    expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
