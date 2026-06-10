import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { PageTransition } from "@/components/layout/PageTransition";

const pathState = vi.hoisted(() => ({ pathname: "/series" }));

vi.mock("next/navigation", () => ({
  usePathname: () => pathState.pathname,
}));

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children, initial }: { children: ReactNode; initial?: boolean }) => (
    <div data-initial={String(initial)} data-testid="animate-presence">
      {children}
    </div>
  ),
  motion: {
    div: ({
      animate,
      children,
      exit,
      initial,
      variants,
    }: {
      animate?: unknown;
      children: ReactNode;
      exit?: unknown;
      initial?: unknown;
      variants?: unknown;
    }) => (
      <div
        data-animate={String(animate)}
        data-exit={String(exit)}
        data-has-variants={String(Boolean(variants))}
        data-initial={String(initial)}
        data-testid="page-motion"
      >
        {children}
      </div>
    ),
  },
  useReducedMotion: () => false,
}));

describe("PageTransition", () => {
  test("keeps non-home content visible on initial render and route changes", () => {
    const { rerender } = render(
      <PageTransition>
        <span>Series</span>
      </PageTransition>,
    );

    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-initial", "false");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-animate", "visible");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-exit", "exit");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-has-variants", "true");
    expect(screen.getByTestId("animate-presence")).toHaveAttribute("data-initial", "false");

    pathState.pathname = "/series/career-reflections";
    rerender(
      <PageTransition>
        <span>Series detail</span>
      </PageTransition>,
    );

    expect(screen.getByTestId("animate-presence")).toHaveAttribute("data-initial", "false");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-initial", "false");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-animate", "visible");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-exit", "exit");
    expect(screen.getByTestId("page-motion")).toHaveAttribute("data-has-variants", "true");
  });
});
