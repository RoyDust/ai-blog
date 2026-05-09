import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("auth route ownership", () => {
  test("lets the NextAuth catch-all own signout cookie clearing", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/api/auth/[...nextauth]/route.ts"))).toBe(true);
    expect(existsSync(path.join(process.cwd(), "src/app/api/auth/signout/route.ts"))).toBe(false);
  });

  test("does not expose a standalone login page route", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/(auth)/login/page.tsx"))).toBe(false);
  });

  test("does not expose a standalone login API route", () => {
    expect(existsSync(path.join(process.cwd(), "src/app/api/auth/login/route.ts"))).toBe(false);
  });
});
