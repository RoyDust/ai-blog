import { expect, test, vi } from "vitest";

test("restoreAllMocks keeps the shared matchMedia implementation", () => {
  vi.restoreAllMocks();
  expect(window.matchMedia("(prefers-reduced-motion: reduce)")).toMatchObject({ matches: false });
});
