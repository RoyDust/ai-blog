import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { AppShell } from "@/components/layout/AppShell";

describe("app shell", () => {
  test("constrains public content with editorial main width and skip link", () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveAttribute("href", "#main-content");
    expect(container.querySelector("main > div")?.className).toContain("max-w-[var(--content-max-width)]");
    expect(container.querySelector("aside")?.className).toContain("xl:w-[var(--rail-width)]");
  });
});
