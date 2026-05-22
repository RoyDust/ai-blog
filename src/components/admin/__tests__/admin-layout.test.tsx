import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const signOut = vi.fn();
const pathnameState = vi.hoisted(() => ({ value: "/admin/taxonomy" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signOut,
}));

describe("admin layout", () => {
  beforeEach(() => {
    pathnameState.value = "/admin/taxonomy";
    window.localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { items: [], unreadCount: 0, nextCursor: null } }),
      }),
    );
  });

  test("renders lightweight blog navigation, static toolbar, and workspace framing", async () => {
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    const { container } = render(
      <AdminLayout siteName="Configured Blog" user={{ email: "roy@example.com", image: "https://example.com/avatar.png", label: "RoyDust", role: "ADMIN" }}>
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
    expect(within(nav).getByRole("link", { name: "分类" })).toHaveAttribute("href", "/admin/taxonomy");
    expect(within(nav).getByRole("link", { name: "媒体库" })).toHaveAttribute("href", "/admin/covers");
    expect(within(nav).getByRole("link", { name: "接口日志" })).toHaveAttribute("href", "/admin/logs");
    const aiAssistant = within(nav).getByText("AI 助手").closest("details");
    expect(aiAssistant).not.toBeNull();
    expect(aiAssistant).not.toHaveAttribute("open");
    fireEvent.click(within(aiAssistant as HTMLElement).getByText("AI 助手"));
    expect(aiAssistant).toHaveAttribute("open");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "AI 日报" })).toHaveAttribute("href", "/admin/ai-news");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "AI 接口" })).toHaveAttribute("href", "/admin/ai/interfaces");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "模型配置" })).toHaveAttribute("href", "/admin/ai/models");
    expect(within(aiAssistant as HTMLElement).getByRole("link", { name: "AI 任务" })).toHaveAttribute("href", "/admin/ai/tasks");
    expect(within(nav).queryByRole("button", { name: "设置稍后开放" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "设置" })).not.toBeInTheDocument();
    const accountMenuButton = screen.getByRole("button", { name: "RoyDust 账号菜单" });
    expect(accountMenuButton).toHaveAttribute("aria-expanded", "false");
    const avatar = screen.getByRole("img", { name: "RoyDust 头像" });
    expect(avatar).toHaveAttribute("src", "https://example.com/avatar.png");
    expect(screen.getByText("roy@example.com")).toBeInTheDocument();
    fireEvent.keyDown(accountMenuButton, { key: "ArrowDown" });
    await waitFor(() => expect(accountMenuButton).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("menuitem", { name: "设置" })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByRole("menuitem", { name: "退出账号" })).toBeInTheDocument();
    expect(screen.getByText("Taxonomy content")).toBeInTheDocument();
    expect(screen.getByText("Configured Blog")).toBeInTheDocument();
    expect(screen.getByText("博客后台")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "新建文章" })).toHaveAttribute("href", "/admin/posts/new");
    expect(screen.getByRole("button", { name: "通知" })).toBeEnabled();
    const globalSearchTrigger = screen.getByRole("button", { name: "打开后台全局搜索" });
    expect(globalSearchTrigger).toHaveTextContent("搜索文章、评论、功能...");
    fireEvent.click(globalSearchTrigger);
    expect(screen.getByRole("dialog", { name: "后台全局搜索" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索文章、评论、功能...")).toBeInTheDocument();
    expect(screen.getByText("常用入口")).toBeInTheDocument();

    expect(container.firstElementChild).toHaveClass("admin-theme");
    expect(container.firstElementChild).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "224");
    expect(screen.getByTestId("admin-layout-main")).toHaveAttribute("data-content-max-width", "full");
    expect(screen.getByTestId("admin-layout-sidebar")).toHaveClass("sticky", "top-0", "h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-content")).toHaveClass("h-screen", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-main")).toHaveClass("flex-1", "overflow-y-auto");
    expect(screen.getByTestId("admin-layout-main").firstElementChild).toHaveClass("max-w-[1840px]");
  });

  test("restores persisted tabs after the initial client render", async () => {
    window.localStorage.setItem(
      "vben_admin_tabs",
      JSON.stringify([
        { href: "/admin", label: "首页" },
        { href: "/admin/persisted", label: "已保存标签" },
      ]),
    );
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    render(
      <AdminLayout siteName="Configured Blog" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Taxonomy content</div>
      </AdminLayout>,
    );

    expect(screen.queryByText("已保存标签")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("已保存标签")).toBeInTheDocument());
    expect(window.localStorage.getItem("vben_admin_tabs")).toContain("/admin/taxonomy");
  });

  test.each([
    ["/admin/posts/new"],
    ["/admin/posts/1/edit"],
  ])("locks page scrolling for post editor route %s", async (pathname) => {
    pathnameState.value = pathname;
    const { AdminLayout } = await import("@/components/admin/shell/AdminLayout");

    const { container } = render(
      <AdminLayout siteName="Configured Blog" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Editor content</div>
      </AdminLayout>,
    );

    const main = screen.getByTestId("admin-layout-main");
    expect(screen.getByText("Editor content")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("fixed", "inset-0", "h-dvh", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-grid")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(screen.getByTestId("admin-layout-content")).toHaveClass("h-full", "min-h-0", "overflow-hidden");
    expect(main).toHaveClass("flex-1", "min-h-0", "overflow-hidden");
    expect(main).not.toHaveClass("overflow-y-auto");
    expect(main.firstElementChild).toHaveClass("h-full", "min-h-0", "max-w-[1840px]");
  });
});
