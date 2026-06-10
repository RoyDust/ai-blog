import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ArticleLoadingState } from "@/components/boundaries/LoadingStates";
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
  });

  test("not found state offers recovery links", () => {
    render(<NotFoundState />);

    expect(screen.getByRole("heading", { name: "没有找到这个页面" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /回到首页/ })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /查看文章/ })).toHaveAttribute("href", "/posts");
  });

  test("article loading state renders a route-specific skeleton", () => {
    render(<ArticleLoadingState />);
    expect(screen.getByTestId("article-loading")).toHaveAccessibleName("文章加载中");
  });
});
