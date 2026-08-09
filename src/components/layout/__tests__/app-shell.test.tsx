import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test, vi } from "vitest";
import { AppShell } from "@/components/layout/AppShell";
import { headerResizeTransition, motionDuration, motionEase } from "@/components/motion/transitions";

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
    expect(container.querySelector(".reader-layout-frame")).toBeInTheDocument();
    expect(container.querySelector(".reader-content-frame")).toBeInTheDocument();
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

  test("home sidebar rail does not add a gray backing layer or vertical offset", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/components.css"), "utf8");

    expect(source).toContain(".reader-shell:has(.reader-home-stage) .reader-side-rail");
    expect(source).toContain('.reader-shell:has(.reader-home-stage) .reader-side-rail [data-testid="sidebar-taxonomy-rail"]');
    expect(source).toContain(".reader-shell:has(.reader-home-stage) .reader-side-rail .reader-panel");
    expect(source).toContain("background: transparent;");
    expect(source).toContain("box-shadow: none;");
    expect(source).toContain("backdrop-filter: none;");
    expect(source).not.toContain(".reader-home-stage {\n    margin-top:");
    expect(source).not.toContain(".reader-shell:has(.reader-home-stage) .reader-side-rail {\n    margin-top:");
  });

  test("route changes keep content view transitions and use layout projection for the persistent navbar", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/components.css"), "utf8");
    const globalsSource = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    const navbarSource = readFileSync(join(process.cwd(), "src/components/layout/Navbar.tsx"), "utf8");
    const motionSource = readFileSync(join(process.cwd(), "src/components/motion/transitions.ts"), "utf8");
    const motionProviderSource = readFileSync(join(process.cwd(), "src/components/motion/BlogMotionProvider.tsx"), "utf8");

    expect(source).toContain(".reader-nav");
    expect(source).toContain(".reader-layout-frame");
    expect(source).toContain("view-transition-name: reader-layout-frame;");
    expect(source).not.toContain("view-transition-name: reader-nav-frame;");
    expect(source).not.toContain("view-transition-name: reader-nav-search;");
    expect(`${source}\n${globalsSource}`).not.toMatch(
      /transition(?:-property)?\s*:\s*[^;]*\b(?:max-width|width)\b[^;]*;/,
    );
    expect(globalsSource).toContain("::view-transition-group(reader-layout-frame)");
    expect(globalsSource).not.toContain("::view-transition-group(reader-nav-frame)");
    expect(globalsSource).not.toContain("::view-transition-group(reader-nav-search)");
    expect(globalsSource).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?::view-transition-group\(\*\),[\s\S]*?::view-transition-old\(\*\),[\s\S]*?::view-transition-new\(\*\)\s*\{[\s\S]*?animation:\s*none !important;/,
    );
    expect(navbarSource).toMatch(
      /<motion\.div\s+layout\s+transition=\{headerResizeTransition\}\s+className="reader-nav\s/,
    );
    expect(navbarSource).not.toMatch(
      /<motion\.div\s+layout="size"\s+transition=\{headerResizeTransition\}\s+className="reader-nav\s/,
    );
    expect(navbarSource).toContain('layout="size"');
    expect(navbarSource).toContain('layout="position"');
    expect(navbarSource).toContain("headerResizeTransition");
    expect(motionSource).toContain("export const headerResizeTransition");
    expect(motionProviderSource).toContain('<MotionConfig reducedMotion="user"');
  });

  test("header resizing uses a slower symmetric layout curve", () => {
    expect(motionDuration.resize).toBe(0.48);
    expect(motionEase.inOut).toEqual([0.65, 0, 0.35, 1]);
    expect(headerResizeTransition).toEqual({
      duration: motionDuration.resize,
      ease: motionEase.inOut,
    });
  });
});
