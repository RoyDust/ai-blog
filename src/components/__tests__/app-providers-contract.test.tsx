import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import { shouldRedirectAdminUnauthorized } from "@/components/AppProviders";
import { ApiRequestError } from "@/lib/client-api";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("app providers contract", () => {
  test("root layout delegates provider wiring to AppProviders", () => {
    const layoutSource = readSource("src/app/layout.tsx");

    expect(layoutSource).toContain('import { AppProviders } from "@/components/AppProviders"');
    expect(layoutSource).toContain("<AppProviders>");
    expect(layoutSource).toContain('"--reader-background-image"');
    expect(layoutSource).toContain("settings.appearance.backgroundImageUrl");
    expect(layoutSource).not.toContain("<AuthProvider>");
    expect(layoutSource).not.toContain("<ThemeProvider>");
    expect(layoutSource).not.toContain("<MotionProvider>");
  });

  test("AppProviders preserves provider order and toaster placement", () => {
    const providersSource = readSource("src/components/AppProviders.tsx");

    expect(providersSource).toContain("<SWRConfig value={swrConfig}>");
    expect(providersSource).toContain("fetcher: apiFetcher");
    expect(providersSource).toContain("onError: handleGlobalSwrError");
    expect(providersSource).toContain("<AuthProvider>");
    expect(providersSource).toContain("<ThemeProvider>");
    expect(providersSource).toContain("<BlogMotionProvider>");
    expect(providersSource).not.toContain("<MotionProvider>");
    expect(providersSource).toContain("{children}");
    expect(providersSource).toContain("<Toaster />");
  });

  test("local SWR handlers preserve global admin auth handling and production deduping", () => {
    const localSWRFiles = [
      "src/app/admin/comments/page.tsx",
      "src/app/admin/newsletter/page.tsx",
      "src/app/admin/series/page.tsx",
      "src/app/admin/topic-guides/page.tsx",
      "src/components/admin/ai-news/hooks/useAiNewsSources.ts",
      "src/components/admin/covers/CoverGalleryManager.tsx",
      "src/components/admin/covers/CoverPicker.tsx",
      "src/components/admin/notifications/NotificationBell.tsx",
      "src/components/admin/notifications/NotificationCenterClient.tsx",
      "src/components/admin/posts/hooks/usePostsList.ts",
      "src/components/admin/taxonomy/hooks/useTaxonomyRows.ts",
      "src/app/admin/ai-news/page.tsx",
      "src/app/(public)/search/SearchPageClient.tsx",
    ];

    for (const file of localSWRFiles) {
      const source = readSource(file);
      expect(source, file).not.toContain("dedupingInterval: 0");

      if (source.includes("onError:")) {
        expect(source, file).toContain("handleGlobalSwrError");
      }
    }
  });

  test("motion and CSS respect reduced-motion preferences", () => {
    const motionSource = readSource("src/components/motion/BlogMotionProvider.tsx");
    const animationsSource = readSource("src/styles/animations.css");

    expect(motionSource).toContain('<MotionConfig reducedMotion="user"');
    expect(animationsSource).toContain("@media (prefers-reduced-motion: reduce)");
    expect(animationsSource).toContain("animation-duration: 0.01ms !important");
    expect(animationsSource).toContain("transition-duration: 0.01ms !important");
    expect(animationsSource).toContain("scroll-behavior: auto !important");
  });
});

describe("shouldRedirectAdminUnauthorized", () => {
  test("后台接口 401 触发跳转判定", () => {
    expect(
      shouldRedirectAdminUnauthorized(new ApiRequestError("登录状态已失效，请重新登录", 401), "/api/admin/posts?page=2"),
    ).toBe(true);
  });

  test("非 401 错误不触发跳转判定", () => {
    expect(
      shouldRedirectAdminUnauthorized(new ApiRequestError("服务器内部错误，请稍后重试", 500), "/api/admin/posts"),
    ).toBe(false);
  });

  test("公共接口的 401 不触发跳转判定", () => {
    expect(
      shouldRedirectAdminUnauthorized(new ApiRequestError("登录状态已失效，请重新登录", 401), "/api/posts?page=1"),
    ).toBe(false);
  });

  test("非 ApiRequestError 或非字符串 key 不触发跳转判定", () => {
    expect(shouldRedirectAdminUnauthorized(new Error("boom"), "/api/admin/posts")).toBe(false);
    expect(shouldRedirectAdminUnauthorized(new ApiRequestError("x", 401), ["/api/admin/posts"])).toBe(false);
  });
});
