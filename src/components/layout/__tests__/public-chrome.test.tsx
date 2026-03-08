import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { Footer } from "@/components/layout/Footer";
import { Sidebar } from "@/components/layout/Sidebar";

test("sidebar and footer use blog shell with localized copy", () => {
  const { container } = render(
    <>
      <Sidebar />
      <Footer />
    </>
  );

  expect(container.querySelectorAll(".card-base").length).toBeGreaterThan(0);
  expect(screen.getByText("全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "快捷导航" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "分类" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "标签" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /文章归档/i })).toHaveAttribute("href", "/archives");
  expect(screen.getByRole("link", { name: "RSS 订阅" })).toHaveAttribute("href", "/rss.xml");
});
