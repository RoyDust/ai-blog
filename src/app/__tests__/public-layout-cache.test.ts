import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("public layout cache boundary", () => {
  test("does not read session-scoped data on the server", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(public)/layout.tsx"), "utf8");

    expect(source).not.toContain("getServerSession");
    expect(source).not.toContain("authOptions");
    expect(source).not.toContain("getUserReadingStats");
  });

  test("does not force public profile reads to bypass caching", () => {
    const source = readFileSync(join(process.cwd(), "src/lib/public-profile.ts"), "utf8");

    expect(source).not.toContain("unstable_noStore");
    expect(source).not.toContain("noStore()");
  });

  test("does not install a route-group loading fallback over cached reader routes", () => {
    expect(existsSync(join(process.cwd(), "src/app/(public)/loading.tsx"))).toBe(false);
  });

  test("opts site-settings-dependent discovery and profile pages out of build-time static baking while keeping 300s data cache", () => {
    const runtimeRenderedRoutes = [
      "src/app/(public)/about/page.tsx",
      "src/app/(public)/contact/page.tsx",
      "src/app/llms.txt/route.ts",
      "src/app/api/ai/openapi/route.ts",
      "src/app/robots.ts",
    ];

    for (const routePath of runtimeRenderedRoutes) {
      const source = readFileSync(join(process.cwd(), routePath), "utf8");
      expect(source).toContain('export const dynamic = "force-dynamic"');
      expect(source).toContain("getBlogSettings");
    }
  });

  test("keeps 300s revalidation contract on searchParams-driven public listing routes backed by unstable_cache readers", () => {
    const revalidateRoutes = [
      "src/app/(public)/posts/page.tsx",
      "src/app/(public)/categories/[slug]/page.tsx",
      "src/app/(public)/tags/[slug]/page.tsx",
    ];

    for (const routePath of revalidateRoutes) {
      const source = readFileSync(join(process.cwd(), routePath), "utf8");
      expect(source).toMatch(/export const revalidate = 300\b/);
    }
  });
});
