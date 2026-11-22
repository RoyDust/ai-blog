import { expect, test, vi } from "vitest";

test("restoreAllMocks keeps the shared matchMedia implementation", () => {
  vi.restoreAllMocks();
  expect(window.matchMedia("(prefers-reduced-motion: reduce)")).toMatchObject({ matches: false });
});

test("requestAnimationFrame safely returns 0 when window is temporarily unavailable", () => {
  const raf = window.requestAnimationFrame;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  try {
    Object.defineProperty(globalThis, "window", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(raf(() => {})).toBe(0);
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, "window", descriptor);
    }
  }
});
