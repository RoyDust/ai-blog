import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { Navbar } from "@/components/layout/Navbar";

const { refresh, useSession } = vi.hoisted(() => ({
  refresh: vi.fn(),
  useSession: vi.fn(),
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
  useSession.mockReset();
  useSession.mockReturnValue({ data: null, status: "unauthenticated" });
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0, writable: true });
});

function scrollTo(y: number) {
  window.scrollY = y;
  fireEvent.scroll(window);
}

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
  expect(desktopSearch?.className).toContain("var(--reader-panel-muted)");
  expect(desktopSearch?.closest("form")?.getAttribute("method")).toBe("get");
  expect(container.querySelector('a[href="/archives"]')).toBeTruthy();
  expect(container.querySelector('a[href="/about"]')).toBeTruthy();
  expect(container.querySelector('a[href="/search"]')).toBeTruthy();
  expect(screen.getByRole("button", { name: "登录账号" })).toBeInTheDocument();

  const archiveLink = container.querySelector('a[href="/archives"]') as HTMLAnchorElement | null;
  expect(archiveLink).toBeTruthy();
  expect(archiveLink?.className).toContain("reader-link");
  expect(archiveLink?.className).toContain("var(--accent-sky)");
  expect(container.innerHTML).not.toContain("hover:bg-[#E2F0FF]");
});

test("navbar preserves mobile menu and control semantics", () => {
  const { container } = render(<Navbar />);
  const menuButton = screen.getByRole("button", { name: "菜单" });
  const paletteButton = screen.getByRole("button", { name: "主题设置" });
  const accountButton = screen.getByRole("button", { name: "登录账号" });
  const mobileMenu = container.querySelector("#mobile-reader-menu");

  expect(menuButton).toHaveAttribute("aria-expanded", "false");
  expect(paletteButton).toHaveAttribute("aria-expanded", "false");
  expect(accountButton).toBeInTheDocument();
  expect(container.querySelectorAll(".reader-icon-btn").length).toBeGreaterThanOrEqual(3);
  expect(mobileMenu).toHaveAttribute("data-state", "closed");
  expect(mobileMenu).toHaveAttribute("aria-hidden", "true");
  expect(container.querySelector('#mobile-reader-menu a[href="/posts"]')).toHaveAttribute("tabindex", "-1");

  fireEvent.click(menuButton);

  expect(menuButton).toHaveAttribute("aria-expanded", "true");
  expect(mobileMenu).toHaveAttribute("data-state", "open");
  expect(mobileMenu).toHaveAttribute("aria-hidden", "false");
  expect(container.querySelector('#mobile-reader-menu a[href="/posts"]')).not.toHaveAttribute("tabindex");
});

test("navbar account entry opens the login dialog without changing the mobile menu state", async () => {
  const { container } = render(<Navbar />);
  const mobileMenu = container.querySelector("#mobile-reader-menu");

  fireEvent.click(screen.getByRole("button", { name: "登录账号" }));

  expect(await screen.findByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "登录账号" })).toBeInTheDocument();
  expect(mobileMenu).toHaveAttribute("data-state", "closed");
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
