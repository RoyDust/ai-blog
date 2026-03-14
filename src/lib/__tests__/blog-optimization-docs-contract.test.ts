import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readDoc(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("blog optimization docs chain", () => {
  test("gap analysis links to roadmap and implementation record", () => {
    const source = readDoc("docs/2026-03-14-blog-optimization-gap-analysis.md");

    expect(source).toContain(".sisyphus/plans/blog-optimization-roadmap.md");
    expect(source).toContain("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");
  });

  test("roadmap links to analysis, plan, and implementation record", () => {
    const source = readDoc(".sisyphus/plans/blog-optimization-roadmap.md");

    expect(source).toContain("docs/2026-03-14-blog-optimization-gap-analysis.md");
    expect(source).toContain("docs/plans/2026-03-15-blog-optimization-p3-cleanup.md");
    expect(source).toContain("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");
  });

  test("implementation record starts with the standard execution sections", () => {
    const source = readDoc("docs/implementation/2026-03-15-blog-optimization-p3-implementation.md");

    expect(source).toContain("## Status Summary");
    expect(source).toContain("## Validation Record");
    expect(source).toContain("## Task Log");
  });
});
