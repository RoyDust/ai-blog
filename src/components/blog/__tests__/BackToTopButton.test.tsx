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

describe("BackToTopButton", () => {
  beforeEach(() => {
    vi.mocked(window.scrollTo).mockClear();
    mockReducedMotion(false);
  });

  test("uses smooth scrolling when reduced motion is not requested", () => {
    render(<BackToTopButton />);

    fireEvent.click(screen.getByRole("button", { name: "返回顶部" }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  test("uses instant scrolling when reduced motion is requested", () => {
    mockReducedMotion(true);
    render(<BackToTopButton />);

    fireEvent.click(screen.getByRole("button", { name: "返回顶部" }));

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
  });
});
