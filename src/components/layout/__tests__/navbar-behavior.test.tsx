import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

const { refresh, toggleTheme, useSession } = vi.hoisted(() => ({
  refresh: vi.fn(),
  toggleTheme: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme }),
}));

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh }),
}));

beforeEach(() => {
  refresh.mockReset();
  toggleTheme.mockReset();
  useSession.mockReset();
  useSession.mockReturnValue({ data: null, status: "unauthenticated" });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0, writable: true });
});

function scrollTo(y: number) {
  window.scrollY = y;
  fireEvent.scroll(window);
}

const navHrefs = ["/", "/posts", "/series", "/archives", "/about"];

test("navbar keeps its desktop navigation centered with a flexible search slot", () => {
  const { container } = render(<Navbar />);

  const readerNav = container.querySelector(".reader-nav");
  const searchSlot = container.querySelector(".reader-nav-search");
  const desktopSearch = container.querySelector('form[role="search"] input[type="search"][name="q"]');

  expect(readerNav).toBeTruthy();
  expect(readerNav?.className).toContain("md:grid");
  expect(readerNav?.className).toContain("md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]");
  expect(searchSlot).toBeTruthy();
  expect(searchSlot?.className).toContain("flex-1");
  expect(searchSlot?.className).toMatch(
    /(?:^|\s)(?:md:|lg:|xl:)?max-w-(?:xs|sm|md|\[[^\s]+\])(?:\s|$)/,
  );
  expect(searchSlot?.querySelector('input[type="search"][name="q"]')).toBe(desktopSearch);
  expect(desktopSearch?.className).not.toContain("var(--reader-panel-muted)");
  expect(desktopSearch?.closest("form")?.getAttribute("method")).toBe("get");
  expect(container.querySelector('a[href="/search"]')).toHaveAttribute("aria-label", "搜索");
  expect(screen.getByRole("button", { name: "登录账号" })).toBeInTheDocument();

  // 桌面导航：纯文字导航项（无图标），当前项 aria-current + 平移下划线
  const primary = screen.getByRole("navigation", { name: "Primary" });
  const links = within(primary).getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual(navHrefs);
  expect(links.map((link) => link.textContent)).toEqual(["首页", "文章", "系列", "归档", "关于"]);
  links.forEach((link) => {
    expect(link).toHaveClass("ed-tab");
    expect(link.querySelector("svg")).toBeNull();
    expect(link.className).not.toContain("reader-link");
  });

  const home = within(primary).getByRole("link", { name: "首页" });
  expect(home).toHaveAttribute("aria-current", "page");
  expect(home.querySelector(".ed-underline")).toBeInTheDocument();
  const archiveLink = within(primary).getByRole("link", { name: "归档" });
  expect(archiveLink).not.toHaveAttribute("aria-current");
  expect(archiveLink.querySelector(".ed-underline")).toBeNull();
  expect(primary.querySelectorAll(".ed-underline")).toHaveLength(1);

  expect(container.innerHTML).not.toContain("hover:bg-[#E2F0FF]");
});

test("navbar preserves mobile menu and control semantics", async () => {
  const { container } = render(<Navbar />);
  const menuButton = screen.getByRole("button", { name: "菜单" });
  const accountButton = screen.getByRole("button", { name: "登录账号" });

  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(menuButton).toHaveAttribute("aria-controls", "mobile-reader-menu");
  expect(menuButton).toHaveClass("ed-icon-btn", "md:hidden");
  expect(accountButton).toBeInTheDocument();
  // 主题色（色相）选择器已移除，只保留明暗切换
  expect(screen.queryByRole("button", { name: "主题设置" })).not.toBeInTheDocument();
  expect(screen.queryByText("主题色")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "切换到日间主题" })).toHaveClass("ed-icon-btn");
  expect(container.querySelectorAll(".ed-icon-btn").length).toBeGreaterThanOrEqual(4);
  expect(container.querySelector(".reader-icon-btn")).toBeNull();
  // 收起时菜单面板不在 DOM 中
  expect(container.querySelector("#mobile-reader-menu")).toBeNull();

  fireEvent.click(menuButton);

  expect(menuButton).toHaveAttribute("aria-expanded", "true");
  const mobileMenu = container.querySelector("#mobile-reader-menu");
  expect(mobileMenu).toHaveAttribute("data-state", "open");
  expect(mobileMenu).toHaveClass("ed-popover", "md:hidden");

  const mobileNav = screen.getByRole("navigation", { name: "移动端导航" });
  const mobileLinks = within(mobileNav).getAllByRole("link");
  expect(mobileLinks.map((link) => link.getAttribute("href"))).toEqual(navHrefs);
  mobileLinks.forEach((link) => {
    expect(link).not.toHaveAttribute("tabindex");
    expect(link.querySelector("svg")).toBeNull();
  });
  expect(within(mobileNav).getByRole("link", { name: "首页" })).toHaveAttribute("aria-current", "page");

  // 手机菜单内的明暗切换：切换后收起菜单
  fireEvent.click(within(mobileNav).getByRole("button", { name: "切换到日间主题" }));
  expect(toggleTheme).toHaveBeenCalledTimes(1);
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await waitFor(() => {
    expect(container.querySelector("#mobile-reader-menu")).toBeNull();
  });

  // Esc 收起
  fireEvent.click(menuButton);
  expect(menuButton).toHaveAttribute("aria-expanded", "true");
  fireEvent.keyDown(window, { key: "Escape" });
  expect(menuButton).toHaveAttribute("aria-expanded", "false");

  // 点击导航项收起
  fireEvent.click(menuButton);
  const postsLink = within(screen.getByRole("navigation", { name: "移动端导航" })).getByRole("link", { name: "文章" });
  // jsdom 不支持真实跳转，阻止默认行为只验证菜单收起
  postsLink.addEventListener("click", (event) => event.preventDefault());
  fireEvent.click(postsLink);
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
});

test("navbar account entry opens the login dialog without changing the mobile menu state", async () => {
  const { container } = render(<Navbar />);
  const menuButton = screen.getByRole("button", { name: "菜单" });

  fireEvent.click(screen.getByRole("button", { name: "登录账号" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(container.querySelector("#mobile-reader-menu")).toBeNull();
});

test("navbar switches immediately after 720 pixels of scrolling in the same direction", () => {
  const { container } = render(<Navbar />);
  const navbar = container.querySelector("#navbar");

  scrollTo(100);
  for (const y of [200, 400, 700, 819]) {
    scrollTo(y);
    expect(navbar).not.toHaveClass("-translate-y-full");
  }
  scrollTo(820);
  expect(navbar).toHaveClass("-translate-y-full");

  scrollTo(2000);
  for (const y of [1900, 1700, 1400, 1281]) {
    scrollTo(y);
    expect(navbar).toHaveClass("-translate-y-full");
  }
  scrollTo(1280);
  expect(navbar).not.toHaveClass("-translate-y-full");
});

test("navbar restarts the scroll distance when direction changes", () => {
  const { container } = render(<Navbar />);
  const navbar = container.querySelector("#navbar");

  scrollTo(3000);
  expect(navbar).toHaveClass("-translate-y-full");

  scrollTo(2500);
  scrollTo(2800);
  scrollTo(2190);
  expect(navbar).toHaveClass("-translate-y-full");

  scrollTo(2080);
  expect(navbar).not.toHaveClass("-translate-y-full");

  scrollTo(2500);
  scrollTo(2200);
  scrollTo(2919);
  expect(navbar).not.toHaveClass("-translate-y-full");

  scrollTo(2920);
  expect(navbar).toHaveClass("-translate-y-full");
});

test("navbar always reappears near the top without waiting for the full distance", () => {
  const { container } = render(<Navbar />);
  const navbar = container.querySelector("#navbar");

  scrollTo(750);
  expect(navbar).toHaveClass("-translate-y-full");

  scrollTo(100);
  expect(navbar).not.toHaveClass("-translate-y-full");
});
