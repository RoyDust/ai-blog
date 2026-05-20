import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

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

    expect(providersSource).toContain("<AuthProvider>");
    expect(providersSource).toContain("<ThemeProvider>");
    expect(providersSource).toContain("<BlogMotionProvider>");
    expect(providersSource).not.toContain("<MotionProvider>");
    expect(providersSource).toContain("{children}");
    expect(providersSource).toContain("<Toaster />");
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
