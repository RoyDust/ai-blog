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
    expect(layoutSource).not.toContain("<AuthProvider>");
    expect(layoutSource).not.toContain("<ThemeProvider>");
    expect(layoutSource).not.toContain("<MotionProvider>");
  });

  test("AppProviders preserves provider order and toaster placement", () => {
    const providersSource = readSource("src/components/AppProviders.tsx");

    expect(providersSource).toContain("<AuthProvider>");
    expect(providersSource).toContain("<ThemeProvider>");
    expect(providersSource).toContain("<MotionProvider>");
    expect(providersSource).toContain("{children}");
    expect(providersSource).toContain("<Toaster />");
  });
});
