import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const apiRoot = join(process.cwd(), "src", "app", "api");
const allowedDisabledRoutes = new Set([
  "src/app/api/internal/operation-logs/route.ts",
]);

function findRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return findRouteFiles(fullPath);
    }

    return entry === "route.ts" ? [fullPath] : [];
  });
}

describe("API operation log coverage", () => {
  test("every API route is logged or explicitly exempted", () => {
    const uncovered = findRouteFiles(apiRoot)
      .map((file) => relative(process.cwd(), file).replace(/\\/g, "/"))
      .filter((file) => !allowedDisabledRoutes.has(file))
      .filter((file) => !readFileSync(file, "utf8").includes("withApiOperationLogging"));

    expect(uncovered).toEqual([]);
  });
});
