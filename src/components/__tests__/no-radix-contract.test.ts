import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

const ROOT_DIR = process.cwd();
const SELF_RELATIVE_PATH = "src/components/__tests__/no-radix-contract.test.ts";

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(fullPath, out);
    } else if (stat.isFile()) {
      out.push(fullPath);
    }
  }
  return out;
}

describe("no Radix / shadcn / cmdk / vaul regression contract", () => {
  test("package.json has zero Radix, cmdk, or vaul dependencies", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT_DIR, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };

    const allDepNames = [
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
      ...Object.keys(pkg.peerDependencies ?? {}),
      ...Object.keys(pkg.optionalDependencies ?? {}),
    ];

    const forbidden = allDepNames.filter(
      (name) =>
        name === "radix-ui" ||
        name.startsWith("@radix-ui/") ||
        name === "cmdk" ||
        name === "vaul",
    );

    expect(forbidden).toEqual([]);
  });

  test("pnpm-lock.yaml has zero radix-ui, @radix-ui, cmdk, or vaul entries", () => {
    const lockfilePath = join(ROOT_DIR, "pnpm-lock.yaml");
    if (!existsSync(lockfilePath)) {
      return;
    }

    const lockfile = readFileSync(lockfilePath, "utf8");
    expect(lockfile).not.toMatch(/(?:^|[\s/'"])@radix-ui\//m);
    expect(lockfile).not.toMatch(/(?:^|[\s/'"])radix-ui(?:@|:|\s|$)/m);
    expect(lockfile).not.toMatch(/(?:^|[\s/'"])cmdk(?:@|:)/m);
    expect(lockfile).not.toMatch(/(?:^|[\s/'"])vaul(?:@|:)/m);
  });

  test("src/components/shadcn directory is completely removed", () => {
    expect(existsSync(join(ROOT_DIR, "src/components/shadcn"))).toBe(false);
  });

  test("src/ contains zero references to Radix, cmdk, vaul, or @/components/shadcn", () => {
    const files = walkFiles(join(ROOT_DIR, "src"));
    const violations: string[] = [];

    const forbiddenPatterns: Array<{ name: string; regex: RegExp }> = [
      { name: "@radix-ui/", regex: /@radix-ui\// },
      { name: "radix-ui", regex: /["']radix-ui["']/ },
      { name: "data-radix-", regex: /data-radix-/ },
      { name: "cmdk", regex: /(?:from|import|require\()\s*["']cmdk["']/ },
      { name: "vaul", regex: /(?:from|import|require\()\s*["']vaul["']/ },
      { name: "@/components/shadcn", regex: /@\/components\/shadcn|components\/shadcn\// },
    ];

    for (const filePath of files) {
      const rel = relative(ROOT_DIR, filePath).replace(/\\/g, "/");
      if (rel === SELF_RELATIVE_PATH) continue;

      const content = readFileSync(filePath, "utf8");
      for (const { name, regex } of forbiddenPatterns) {
        if (regex.test(content)) {
          violations.push(`${rel} matches ${name}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
