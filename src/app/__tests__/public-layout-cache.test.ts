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
});
