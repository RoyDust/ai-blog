import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

describe("app shell", () => {
  test("keeps skip link contract and renders desktop rail before main content", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    const mainContent = container.querySelector("#main-content");
    const sidebarRail = container.querySelector('[data-testid="sidebar-rail"]');
    const shellColumns = mainContent?.parentElement;

    expect(container.firstElementChild?.className).toContain("reader-shell");
    expect(container.querySelector('[data-testid="reader-ambient-banner"]')).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(screen.getByRole("link", { name: "跳到主要内容" }).className).toContain("reader-panel");
    expect(container.querySelector("main > div")?.className).toContain("max-w-[var(--content-max-width)]");
    expect(sidebarRail).toBeInTheDocument();
    expect(mainContent).toBeInTheDocument();
    expect(sidebarRail?.className).toContain("xl:w-[var(--rail-width)]");
    expect(sidebarRail?.className).toContain("hidden");
    expect(sidebarRail?.className).toContain("xl:block");
    expect(shellColumns?.className).toContain("flex-col");
    expect(shellColumns?.className).toContain("xl:flex-row");
    expect(sidebarRail?.compareDocumentPosition(mainContent as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
