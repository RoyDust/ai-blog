import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const signOut = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/taxonomy",
}));

vi.mock("next-auth/react", () => ({
  signOut,
}));

describe("admin layout", () => {
  test("renders lightweight blog navigation, static toolbar, and workspace framing", async () => {
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    const { container } = render(
      <AdminLayout user={{ email: "roy@example.com", image: "https://example.com/avatar.png", label: "RoyDust", role: "ADMIN" }}>
        <div>Taxonomy content</div>
      </AdminLayout>,
    );

    const nav = screen.getByRole("navigation", { name: "Admin navigation" });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByText("博客后台")).toBeInTheDocument();
    expect(within(nav).queryByText("主导航")).not.toBeInTheDocument();
    expect(within(nav).queryByText("AI 辅助")).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "首页" })).toHaveAttribute("href", "/admin");
    expect(within(nav).getByRole("link", { name: "文章" })).toHaveAttribute("href", "/admin/posts");
    expect(within(nav).queryByRole("link", { name: "草稿" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /评论/ })).toHaveAttribute("href", "/admin/comments");
    expect(within(nav).getByText("5")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "分类" })).toHaveAttribute("href", "/admin/taxonomy");
    expect(within(nav).getByRole("link", { name: "媒体库" })).toHaveAttribute("href", "/admin/covers");
    const aiAssistant = within(nav).getByText("AI 助手").closest("details");
    expect(aiAssistant).not.toBeNull();
    expect(aiAssistant).not.toHaveAttribute("open");
    fireEvent.click(within(aiAssistant as HTMLElement).getByText("AI 助手"));
    expect(aiAssistant).toHaveAttribute("open");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "AI 日报" })).toHaveAttribute("href", "/admin/ai-news");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "模型配置" })).toHaveAttribute("href", "/admin/ai/models");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "AI 任务" })).toHaveAttribute("href", "/admin/ai/tasks");
    expect(within(nav).queryByRole("button", { name: "设置稍后开放" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "设置" })).not.toBeInTheDocument();
    const accountMenuButton = screen.getByRole("button", { name: "RoyDust 账号菜单" });
    expect(accountMenuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("img", { name: "RoyDust 头像" })).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(screen.getByText("roy@example.com")).toBeInTheDocument();
    fireEvent.keyDown(accountMenuButton, { key: "ArrowDown" });
    await waitFor(() => expect(accountMenuButton).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("menuitem", { name: "设置" })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByRole("menuitem", { name: "退出账号" })).toBeInTheDocument();
    expect(screen.getByText("Taxonomy content")).toBeInTheDocument();
    expect(screen.getByText("roydust.top")).toBeInTheDocument();
    expect(screen.getByText("博客后台")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索文章、页面、评论...")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新建文章" })).toHaveAttribute("href", "/admin/posts/new");
    expect(screen.getByRole("button", { name: "通知功能稍后开放" })).toBeDisabled();

    expect(container.firstElementChild).toHaveClass("admin-theme");
    expect(container.firstElementChild).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "224");
    expect(screen.getByTestId("admin-layout-main")).toHaveAttribute("data-content-max-width", "full");
    expect(screen.getByTestId("admin-layout-sidebar")).toHaveClass("sticky", "top-0", "h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-content")).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-main")).toHaveClass("flex-1", "overflow-y-auto");
    expect(screen.getByTestId("admin-layout-main").firstElementChild).toHaveClass("max-w-[1840px]");
  });
});
