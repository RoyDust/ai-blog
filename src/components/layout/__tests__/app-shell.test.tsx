import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

vi.mock("next-auth/react", () => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  useSession: () => ({ data: null, status: "unauthenticated" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("app shell", () => {
  test("keeps skip link contract and renders desktop rail before main content", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const mainContent = container.querySelector("#main-content");
    const sidebarRail = container.querySelector('[data-testid="sidebar-rail"]');

    expect(container.firstElementChild?.className).toContain("reader-shell");
    expect(container.querySelector('[data-testid="reader-ambient-banner"]')).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("link", { name: "跳到主要内容" }).className).toContain("reader-panel");
    expect(container.querySelector("main div.max-w-\\[var\\(--content-max-width\\)\\]")).toBeInTheDocument();
    expect(sidebarRail).toBeInTheDocument();
    expect(mainContent).toBeInTheDocument();

    if (!sidebarRail || !mainContent) {
      throw new Error("Expected app shell layout nodes to render");
    }

    const shellColumns = mainContent.parentElement;
    expect(sidebarRail.className).toContain("xl:w-[var(--rail-width)]");
    expect(sidebarRail.className).toContain("hidden");
    expect(sidebarRail.className).toContain("xl:block");
    expect(shellColumns?.className).toContain("flex-col");
    expect(shellColumns?.className).toContain("xl:flex-row");
    expect(sidebarRail.compareDocumentPosition(mainContent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("home sidebar rail does not add a gray backing layer", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/components.css"), "utf8");

    expect(source).toContain(".reader-shell:has(.reader-home-stage) .reader-side-rail");
    expect(source).toContain('.reader-shell:has(.reader-home-stage) .reader-side-rail [data-testid="sidebar-taxonomy-rail"]');
    expect(source).toContain(".reader-shell:has(.reader-home-stage) .reader-side-rail .reader-panel");
    expect(source).toContain("background: transparent;");
    expect(source).toContain("box-shadow: none;");
    expect(source).toContain("backdrop-filter: none;");
    expect(source).toContain("margin-top: calc(var(--reader-page-top) * -0.08);");
  });
});
