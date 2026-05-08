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
});

test("navbar renders a reader floating shell with a wide desktop search", () => {
  const { container } = render(<Navbar />);

  const desktopSearch = Array.from(container.querySelectorAll('input[type="search"][name="q"]')).find((node) =>
    (node as HTMLInputElement).className.includes("lg:w-72")
  ) as HTMLInputElement | undefined;

  expect(container.querySelector(".reader-nav")).toBeTruthy();
  expect(desktopSearch).toBeTruthy();
  expect(desktopSearch?.className).toContain("lg:w-72");
  expect(desktopSearch?.className).toContain("xl:w-80");
  expect(desktopSearch?.className).toContain("var(--reader-panel-elevated)");
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
