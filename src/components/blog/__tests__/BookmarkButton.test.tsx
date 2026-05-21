import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BookmarkButton } from "../BookmarkButton";

// Mock the bookmark-store helpers
vi.mock("@/lib/bookmark-store", () => ({
  addBookmark: vi.fn(),
  isBookmarked: () => false,
  removeBookmark: vi.fn(),
}));

function mockReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
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

function mockCanvas() {
  const fillStyles: string[] = [];
  const frameCallbacks: FrameRequestCallback[] = [];
  const context = {
    scale: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    set fillStyle(value: string) {
      fillStyles.push(value);
    },
    get fillStyle() {
      return fillStyles.at(-1) ?? "";
    },
  };

  const getContext = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation(() => context as unknown as CanvasRenderingContext2D);

  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    bottom: 120,
    height: 120,
    left: 0,
    right: 120,
    top: 0,
    width: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    frameCallbacks.push(callback);
    return frameCallbacks.length;
  });

  return { fillStyles, frameCallbacks, getContext };
}

afterEach(() => {
  document.documentElement.style.removeProperty("--hue");
  vi.restoreAllMocks();
});

describe("BookmarkButton", () => {
  test("renders initial unbookmarked state", () => {
    render(
      <BookmarkButton
        slug="test-post"
        initialBookmarked={false}
        title="Test Title"
        excerpt="Test Excerpt"
      />,
    );

    // Check button label is set to '收藏文章'
    expect(screen.getByRole("button", { name: "收藏文章" })).toBeInTheDocument();
    expect(screen.getByText("收藏")).toBeInTheDocument();
  });

  test("renders initial bookmarked state", () => {
    render(
      <BookmarkButton
        slug="test-post"
        initialBookmarked={true}
        title="Test Title"
        excerpt="Test Excerpt"
      />,
    );

    // Check button label is set to '已收藏'
    expect(screen.getByRole("button", { name: "已收藏" })).toBeInTheDocument();
    expect(screen.getByText("已收藏")).toBeInTheDocument();
  });

  test("skips canvas particles when reduced motion is enabled", () => {
    mockReducedMotion(true);
    const { getContext } = mockCanvas();

    render(
      <BookmarkButton
        slug="test-post"
        initialBookmarked={false}
        title="Test Title"
        excerpt="Test Excerpt"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "收藏文章" }));

    expect(getContext).not.toHaveBeenCalled();
  });

  test("draws particles with colors derived from the current hue", () => {
    mockReducedMotion(false);
    document.documentElement.style.setProperty("--hue", "210");
    const { fillStyles, frameCallbacks, getContext } = mockCanvas();

    render(
      <BookmarkButton
        slug="test-post"
        initialBookmarked={false}
        title="Test Title"
        excerpt="Test Excerpt"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "收藏文章" }));
    frameCallbacks[0]?.(performance.now());

    expect(getContext).toHaveBeenCalled();
    expect(fillStyles.length).toBeGreaterThan(0);
    expect(fillStyles).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^hsl\((206|224|234|254|274) 88% \d+%\)$/),
      ]),
    );
    expect(fillStyles.join(" ")).not.toMatch(/#[\da-f]{3,8}/i);
  });
});
