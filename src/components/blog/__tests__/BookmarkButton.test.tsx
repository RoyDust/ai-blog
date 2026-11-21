import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { addBookmark, isBookmarked } from "@/lib/bookmark-store";
import { BookmarkButton } from "../BookmarkButton";

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

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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

    expect(screen.getByRole("button", { name: "已收藏" })).toBeInTheDocument();
    expect(screen.getByText("已收藏")).toBeInTheDocument();
  });

  test("hydrates without mismatch warnings when localStorage already has the post bookmarked and supports toggling", () => {
    mockReducedMotion(true);
    addBookmark({ slug: "hydrated-post", title: "Hydrated Title" });

    const element = (
      <BookmarkButton
        slug="hydrated-post"
        initialBookmarked={false}
        title="Hydrated Title"
        excerpt="Hydrated Excerpt"
      />
    );

    const ssrHtml = renderToString(element);
    expect(ssrHtml).toContain('aria-label="收藏文章"');

    const container = document.createElement("div");
    container.innerHTML = ssrHtml;
    document.body.appendChild(container);

    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let root: ReturnType<typeof hydrateRoot> | null = null;

    try {
      act(() => {
        root = hydrateRoot(container, element);
      });

      const errorMessages = consoleErrorSpy.mock.calls.map((args) => args.map(String).join(" ")).join("\n");
      expect(errorMessages).not.toMatch(/hydrat|did not match|mismatch/i);

      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button).toHaveAttribute("aria-label", "已收藏");

      act(() => {
        fireEvent.click(button);
      });
      expect(isBookmarked("hydrated-post")).toBe(false);
      expect(button).toHaveAttribute("aria-label", "收藏文章");

      act(() => {
        fireEvent.click(button);
      });
      expect(isBookmarked("hydrated-post")).toBe(true);
      expect(button).toHaveAttribute("aria-label", "已收藏");

      act(() => {
        window.localStorage.clear();
        window.dispatchEvent(new StorageEvent("storage", { key: "local-bookmarks" }));
      });
      expect(button).toHaveAttribute("aria-label", "收藏文章");
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
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
        expect.stringMatching(/^hsl\((206|224|234|254|274) 52% \d+%\)$/),
      ]),
    );
    expect(fillStyles.join(" ")).not.toMatch(/#[\da-f]{3,8}/i);
  });

  test("renders and handles clicks safely without crashing when browser storage is disabled", () => {
    mockReducedMotion(true);
    const getItemSpy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });

    render(
      <BookmarkButton
        slug="storage-blocked-post"
        initialBookmarked={false}
        title="Blocked Storage Title"
        excerpt="Excerpt"
      />,
    );

    const button = screen.getByRole("button", { name: "收藏文章" });
    expect(button).toBeInTheDocument();
    expect(() => fireEvent.click(button)).not.toThrow();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
