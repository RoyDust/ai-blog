import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LikeButton } from "../LikeButton";

// Mock the getOrCreateBrowserId helper
vi.mock("@/lib/browser-id", () => ({
  getOrCreateBrowserId: () => "mock-browser-id",
}));

function mockFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { liked: false, count: 5 },
      }),
    }),
  );
}

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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LikeButton", () => {
  test("renders initial count and state", () => {
    render(<LikeButton slug="test-post" initialLiked={false} initialCount={5} />);

    // Check count is rendered
    expect(screen.getByText("5")).toBeInTheDocument();
    
    // Check button label is set to '点赞'
    expect(screen.getByRole("button", { name: "点赞" })).toBeInTheDocument();
  });

  test("renders initial liked state", () => {
    render(<LikeButton slug="test-post" initialLiked={true} initialCount={12} />);

    // Check count is rendered
    expect(screen.getByText("12")).toBeInTheDocument();
    
    // Check button label is set to '取消点赞'
    expect(screen.getByRole("button", { name: "取消点赞" })).toBeInTheDocument();
  });

  test("skips canvas particles when reduced motion is enabled", () => {
    mockFetch();
    mockReducedMotion(true);
    const { getContext } = mockCanvas();

    render(<LikeButton slug="test-post" initialLiked={false} initialCount={5} />);
    fireEvent.click(screen.getByRole("button", { name: "点赞" }));

    expect(getContext).not.toHaveBeenCalled();
  });

  test("draws particles with colors derived from the current hue", () => {
    mockFetch();
    mockReducedMotion(false);
    document.documentElement.style.setProperty("--hue", "210");
    const { fillStyles, frameCallbacks, getContext } = mockCanvas();

    render(<LikeButton slug="test-post" initialLiked={false} initialCount={5} />);
    fireEvent.click(screen.getByRole("button", { name: "点赞" }));
    frameCallbacks[0]?.(performance.now());

    expect(getContext).toHaveBeenCalled();
    expect(fillStyles.length).toBeGreaterThan(0);
    expect(fillStyles).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^hsl\((168|184|192|210|228) 88% \d+%\)$/),
      ]),
    );
    expect(fillStyles.join(" ")).not.toMatch(/#[\da-f]{3,8}/i);
  });
});
