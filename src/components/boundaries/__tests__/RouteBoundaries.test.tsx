import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AdminLoadingState, ArticleLoadingState } from "@/components/boundaries/LoadingStates";
import { NotFoundState } from "@/components/boundaries/NotFoundState";
import { RouteErrorState } from "@/components/boundaries/RouteErrorState";

describe("route boundary states", () => {
  test("route error state exposes a retry action", () => {
    const reset = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RouteErrorState error={new Error("broken render")} reset={reset} />);

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toHaveTextContent("这页内容暂时没能加载");
    // 错误态：一句 danger 衬线文案 + 描边「重试」+ 文字链接，不加容器
    expect(screen.getByRole("heading", { name: "这页内容暂时没能加载" })).toHaveClass("ed-empty__title", "ed-empty__title--danger");
    expect(screen.getByRole("button", { name: "重试" })).toHaveClass("ed-btn-outline");
    expect(screen.getByRole("link", { name: "回到首页" })).toHaveClass("ed-link");
    expect(document.querySelector(".reader-panel, svg")).toBeNull();
  });

  test("admin error state uses the 36px outline button and links back to the admin home", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<RouteErrorState error={Object.assign(new Error("boom"), { digest: "abc123" })} reset={() => {}} scope="admin" />);

    expect(screen.getByRole("button", { name: "重试" })).toHaveClass("ed-btn-outline", "ed-btn--sm");
    expect(screen.getByRole("link", { name: "回到后台" })).toHaveAttribute("href", "/admin");
    expect(screen.getByText("错误编号：abc123")).toHaveClass("ed-mono");
  });

  test("not found state offers recovery links", () => {
    render(<NotFoundState />);

    expect(screen.getByRole("heading", { name: "没有找到这个页面" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /回到首页/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /查看文章/ })).toHaveAttribute("href", "/posts");
    expect(screen.getByRole("heading", { name: "没有找到这个页面" })).toHaveClass("ed-empty__title");
    expect(screen.getByRole("link", { name: /回到首页/ })).toHaveClass("ed-link");
    expect(document.querySelector(".reader-panel, svg")).toBeNull();
  });

  test("root not found sits on the page background without a panel", () => {
    render(<NotFoundState scope="root" />);
    expect(screen.getByTestId("root-not-found")).toHaveClass("bg-[var(--page-bg)]", "min-h-screen");
  });

  test("article loading state renders a route-specific skeleton", () => {
    render(<ArticleLoadingState />);
    expect(screen.getByTestId("article-loading")).toHaveAccessibleName("文章加载中");
    expect(document.querySelectorAll(".ed-skel").length).toBeGreaterThan(5);
    expect(document.querySelector(".reader-skeleton, .reader-card, .reader-panel")).toBeNull();
  });

  test("admin loading state draws thin bars and hairlines only", () => {
    render(<AdminLoadingState />);
    expect(screen.getByTestId("admin-loading")).toHaveAccessibleName("后台加载中");
    expect(document.querySelectorAll(".ed-skel").length).toBeGreaterThan(5);
    expect(document.querySelector(".reader-skeleton, .rounded-lg")).toBeNull();
  });
});
