import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ACCEPTED_GUARDS = ["requireInternalSecret", "isValidInternalSecret", "isValidOperationLogIngestSecret"];
const allowedExemptedRoutes = new Set<string>([]);

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return findRouteFiles(fullPath);
    }

    return entry === "route.ts" ? [fullPath] : [];
  });
}

describe("internal api protection coverage", () => {
  test("every cron/internal route validates an internal secret", () => {
    const roots = ["src/app/api/cron", "src/app/api/internal"].map((root) => join(process.cwd(), root));

    const uncovered = roots
      .flatMap(findRouteFiles)
      .map((file) => relative(process.cwd(), file).replace(/\\/g, "/"))
      .filter((file) => !allowedExemptedRoutes.has(file))
      .filter((file) => {
        const source = readFileSync(file, "utf8");
        return !ACCEPTED_GUARDS.some((guard) => source.includes(guard));
      });

    expect(uncovered).toEqual([]);
  });

  test("every cron/internal route has an exact middleware registration", () => {
    const roots = ["src/app/api/cron", "src/app/api/internal"].map((root) => join(process.cwd(), root));
    const middlewareSource = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

    const unregistered = roots
      .flatMap(findRouteFiles)
      .map((file) => relative(join(process.cwd(), "src/app"), file).replace(/\\/g, "/"))
      .map((file) => `/${file.replace(/\/route\.ts$/, "")}`)
      .filter(
        (routePath) =>
          !middlewareSource.includes(`path: '${routePath}'`) &&
          !middlewareSource.includes(`path: "${routePath}"`),
      );

    expect(unregistered).toEqual([]);
  });
});
