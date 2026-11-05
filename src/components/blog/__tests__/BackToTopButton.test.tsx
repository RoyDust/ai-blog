import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { BackToTopButton } from "../BackToTopButton";

function mockReducedMotion(matches: boolean) {
  vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function getButton() {
  const button = screen.getByText("回到顶部").closest("button");
  if (!button) throw new Error("back-to-top button missing");
  return button;
}

describe("BackToTopButton", () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear();
    mockReducedMotion(false);
  });

  test("renders an outline text button that stays out of the tab order until the reader scrolls", () => {
    render(<BackToTopButton />);

    const button = getButton();
    expect(button.className).toContain("ed-btn-outline");
    expect(button.className).toContain("article-float-btn");
    expect(button).toHaveAttribute("aria-hidden", "true");
    expect(button).toHaveAttribute("tabindex", "-1");
    expect(button.querySelector("svg")).toBeNull();
  });

  test("uses smooth scrolling when reduced motion is not requested", () => {
    render(<BackToTopButton />);

    fireEvent.click(getButton());

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  test("uses instant scrolling when reduced motion is requested", () => {
    mockReducedMotion(true);
    render(<BackToTopButton />);

    fireEvent.click(getButton());

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
