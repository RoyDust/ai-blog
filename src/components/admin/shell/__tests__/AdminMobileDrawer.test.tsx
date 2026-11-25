import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { adminNavItems } from "../config";
import { MOBILE_MEDIA_QUERY } from "../AdminLayoutContext";

const signOut = vi.fn();
const pathnameState = vi.hoisted(() => ({ value: "/admin" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next-auth/react", () => ({
  signOut,
}));

function setViewportWidth(width: number, rootFontSizePx = 16) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });

  const desktopMinPx = 64 * rootFontSizePx;

  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === "(max-width: 63.999rem)" ? width < desktopMinPx : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

describe("Admin mobile navigation drawer (< 1024px)", () => {
  beforeEach(() => {
    pathnameState.value = "/admin";
    window.localStorage.clear();
    signOut.mockReset();
    setViewportWidth(390);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { items: [], unreadCount: 0, nextCursor: null } }),
      }),
    );
  });

  afterEach(() => {
    setViewportWidth(1024);
    vi.unstubAllGlobals();
  });

  test("opens mobile drawer on < 1024px with full nav links, Settings, Sign Out, and 0 dialog accessibility warnings", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { AdminLayout } = await import("../AdminLayout");

      render(
        <AdminLayout
          siteName="Inkforge"
          user={{
            email: "roy@example.com",
            image: "https://example.com/avatar.png",
            label: "RoyDust",
            role: "ADMIN",
          }}
        >
          <div>Dashboard body</div>
        </AdminLayout>,
      );

      const menuButton = screen.getByRole("button", { name: "打开导航菜单" });
      expect(menuButton).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();

      fireEvent.click(menuButton);

      const drawer = screen.getByRole("dialog", { name: "后台导航菜单" });
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveClass("admin-theme");
      expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "224");

      const mobileNav = within(drawer).getByRole("navigation", { name: "移动端后台导航" });
      for (const item of adminNavItems) {
        const link = within(mobileNav).getByRole("link", { name: item.label });
        expect(link).toHaveAttribute("href", item.href);
      }
      expect(within(mobileNav).getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");

      expect(within(drawer).getByText("RoyDust")).toBeInTheDocument();
      expect(within(drawer).getByText("roy@example.com")).toBeInTheDocument();
      expect(within(drawer).getByRole("link", { name: "设置" })).toHaveAttribute("href", "/admin/settings");
      expect(within(drawer).getByRole("button", { name: "退出登录" })).toBeInTheDocument();

      const dialogWarnings = [...warnSpy.mock.calls, ...errorSpy.mock.calls]
        .flat()
        .map(String)
        .filter((msg) => /DialogContent|DialogTitle|Description|aria-describedby/i.test(msg));
      expect(dialogWarnings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test("closes mobile drawer automatically when pathname changes or viewport crosses >= 1024px", async () => {
    const { AdminLayout } = await import("../AdminLayout");

    const { rerender } = render(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Dashboard body</div>
      </AdminLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    expect(screen.getByRole("dialog", { name: "后台导航菜单" })).toBeInTheDocument();

    pathnameState.value = "/admin/posts";
    rerender(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Posts body</div>
      </AdminLayout>,
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
    });

    // 再次打开后将视口切回桌面端 >= 1024px，抽屉自动关闭
    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    expect(screen.getByRole("dialog", { name: "后台导航菜单" })).toBeInTheDocument();

    setViewportWidth(1280);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
    });
  });

  test("executes sign out from mobile drawer and clears admin session storage", async () => {
    window.localStorage.setItem("vben_admin_tabs", JSON.stringify([{ href: "/admin", label: "首页" }]));
    window.localStorage.setItem("author:draft:new", JSON.stringify({ title: "草稿" }));
    window.localStorage.setItem("reader_theme", "dark");

    const { AdminLayout } = await import("../AdminLayout");

    render(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Dashboard body</div>
      </AdminLayout>,
    );

    // 等待初始页签恢复宏任务完成后再触发退出登录
    await waitFor(() => {
      expect(window.localStorage.getItem("vben_admin_tabs")).toContain("/admin");
    });

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    const drawer = screen.getByRole("dialog", { name: "后台导航菜单" });
    fireEvent.click(within(drawer).getByRole("button", { name: "退出登录" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem("vben_admin_tabs")).toBeNull();
    expect(window.localStorage.getItem("author:draft:new")).toBeNull();
    expect(window.localStorage.getItem("reader_theme")).toBe("dark");
  });

  test("preserves desktop sidebar collapse toggle on >= 1024px viewports", async () => {
    setViewportWidth(1280);
    const { AdminLayout } = await import("../AdminLayout");

    render(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Dashboard body</div>
      </AdminLayout>,
    );

    const collapseButton = screen.getByRole("button", { name: "收起侧边栏" });
    expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "224");

    fireEvent.click(collapseButton);

    expect(screen.getByTestId("admin-layout-grid")).toHaveAttribute("data-layout-sidebar-width", "64");
    expect(screen.getByRole("button", { name: "展开侧边栏" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
  });

  test("exposes mobile drawer actions on AdminLayoutContext and closes drawer when clicking a nav link", async () => {
    const { AdminLayout } = await import("../AdminLayout");
    const { useAdminLayout } = await import("../AdminLayoutContext");

    function ContextProbe() {
      const {
        isMobileDrawerOpen,
        openMobileDrawer,
        closeMobileDrawer,
        toggleMobileDrawer,
        setMobileDrawerOpen,
      } = useAdminLayout();

      return (
        <div>
          <span data-testid="drawer-state">{String(isMobileDrawerOpen)}</span>
          <button onClick={openMobileDrawer} type="button">probe-open</button>
          <button onClick={closeMobileDrawer} type="button">probe-close</button>
          <button onClick={toggleMobileDrawer} type="button">probe-toggle</button>
          <button onClick={() => setMobileDrawerOpen(true)} type="button">probe-set-true</button>
        </div>
      );
    }

    render(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <ContextProbe />
      </AdminLayout>,
    );

    expect(screen.getByTestId("drawer-state")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "probe-open" }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("true");
    fireEvent.click(screen.getByRole("button", { name: "probe-close", hidden: true }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("false");
    fireEvent.click(screen.getByRole("button", { name: "probe-toggle" }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("true");

    const drawer = screen.getByRole("dialog", { name: "后台导航菜单" });
    const mobileNav = within(drawer).getByRole("navigation", { name: "移动端后台导航" });
    const postsLink = within(mobileNav).getByRole("link", { name: "文章" });
    postsLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(postsLink);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("false");

    fireEvent.click(screen.getByRole("button", { name: "probe-set-true" }));
    expect(screen.getByTestId("drawer-state")).toHaveTextContent("true");
  });

  test("uses rem-based MOBILE_MEDIA_QUERY (63.999rem) aligned with Tailwind lg: (64rem) when root font-size is scaled to 20px", async () => {
    expect(MOBILE_MEDIA_QUERY).toBe("(max-width: 63.999rem)");

    // 根字号 20px 时 64rem = 1280px；1100px 虽 >= 1024px 但仍处于移动端抽屉区间
    setViewportWidth(1100, 20);
    const { AdminLayout } = await import("../AdminLayout");

    render(
      <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
        <div>Dashboard body</div>
      </AdminLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
    expect(screen.getByRole("dialog", { name: "后台导航菜单" })).toBeInTheDocument();

    // 跨过 64rem (1280px) 时自动收起抽屉
    setViewportWidth(1280, 20);
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "后台导航菜单" })).not.toBeInTheDocument();
    });
  });

  test("never blocks signOut when browser localStorage throws SecurityError", async () => {
    const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("Access is denied for this document.", "SecurityError");
    });

    try {
      const { AdminLayout } = await import("../AdminLayout");

      render(
        <AdminLayout siteName="Inkforge" user={{ label: "RoyDust", role: "ADMIN" }}>
          <div>Dashboard body</div>
        </AdminLayout>,
      );

      fireEvent.click(screen.getByRole("button", { name: "打开导航菜单" }));
      const drawer = screen.getByRole("dialog", { name: "后台导航菜单" });
      fireEvent.click(within(drawer).getByRole("button", { name: "退出登录" }));

      await waitFor(() => {
        expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" });
      });
    } finally {
      removeItemSpy.mockRestore();
    }
  });
});
