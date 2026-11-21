import { describe, expect, test } from "vitest";

import {
  getPostViewTransitionName,
  getSeriesViewTransitionName,
  toSafeSlug,
} from "../view-transition";

const CSS_CUSTOM_IDENT_PATTERN = /^[a-z][a-z0-9-]*$/;
const CSS_RESERVED_IDENTS = new Set([
  "unset",
  "initial",
  "inherit",
  "revert",
  "revert-layer",
  "default",
  "none",
  "auto",
]);

function expectValidCssCustomIdent(value: string) {
  expect(value.length).toBeGreaterThan(0);
  expect(value.length).toBeLessThanOrEqual(80);
  expect(value).toMatch(CSS_CUSTOM_IDENT_PATTERN);
  expect(value).not.toContain("--");
  expect(CSS_RESERVED_IDENTS.has(value)).toBe(false);
}

describe("view transition names", () => {
  test("preserves pure lowercase ASCII slugs unchanged", () => {
    expect(toSafeSlug("ai-daily-2026-01-01")).toBe("ai-daily-2026-01-01");
    expect(toSafeSlug("hello-world")).toBe("hello-world");
    expect(getPostViewTransitionName("title", "ai-daily-2026-01-01")).toBe(
      "post-title-ai-daily-2026-01-01",
    );
    expect(getSeriesViewTransitionName("cover", "ai-daily")).toBe("series-cover-ai-daily");
  });

  test("falls back to unknown for empty or whitespace-only slugs", () => {
    expect(toSafeSlug("")).toBe("unknown");
    expect(toSafeSlug("   ")).toBe("unknown");
    expect(getPostViewTransitionName("title", "   ")).toBe("post-title-unknown");
  });

  test("produces distinct deterministic valid CSS custom-idents for Chinese and non-ASCII slugs", () => {
    const slugA = toSafeSlug("大模型推理优化实践");
    const slugB = toSafeSlug("多模态智能体架构设计");
    const mixedA = toSafeSlug("2026年日报：第一期");
    const mixedB = toSafeSlug("2026年日报：第二期");

    expectValidCssCustomIdent(slugA);
    expectValidCssCustomIdent(slugB);
    expectValidCssCustomIdent(mixedA);
    expectValidCssCustomIdent(mixedB);

    expect(slugA).not.toBe("unknown");
    expect(slugB).not.toBe("unknown");
    expect(slugA).not.toBe(slugB);
    expect(mixedA).not.toBe(mixedB);
    expect(toSafeSlug("大模型推理优化实践")).toBe(slugA);

    expect(getPostViewTransitionName("title", "大模型推理优化实践")).not.toBe(
      getPostViewTransitionName("title", "多模态智能体架构设计"),
    );
    expect(getSeriesViewTransitionName("title", "前端工程化专栏")).not.toBe(
      getSeriesViewTransitionName("title", "后端架构专栏"),
    );
  });

  test("appends deterministic hash for legacy punctuation or overlong slugs to prevent collisions", () => {
    const legacyPunctuation = getPostViewTransitionName("cover", "legacy post/2026?draft=true");
    const canonicalAscii = getPostViewTransitionName("cover", "legacy-post-2026-draft-true");

    expect(legacyPunctuation).toMatch(/^post-cover-legacy-post-2026-draft-true-[a-z0-9]{6,7}$/);
    expect(legacyPunctuation).not.toBe(canonicalAscii);

    const longA = toSafeSlug(`${"a".repeat(90)}-alpha`);
    const longB = toSafeSlug(`${"a".repeat(90)}-beta`);
    expectValidCssCustomIdent(longA);
    expectValidCssCustomIdent(longB);
    expect(longA).not.toBe(longB);
  });
});
