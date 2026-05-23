import { describe, expect, test } from "vitest";

import { getPostViewTransitionName } from "../view-transition";

describe("view transition names", () => {
  test("sanitizes imported or legacy slugs before using them as CSS idents", () => {
    expect(getPostViewTransitionName("cover", "legacy post/2026?draft=true")).toBe("post-cover-legacy-post-2026-draft-true");
    expect(getPostViewTransitionName("title", "   ")).toBe("post-title-unknown");
  });
});
