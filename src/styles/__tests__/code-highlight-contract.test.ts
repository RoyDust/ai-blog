import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("code highlight styles", () => {
  test("keeps dark-mode token contrast overrides", () => {
    const source = readFileSync(join(process.cwd(), "src/styles/code-highlight.css"), "utf8");

    expect(source).toContain("html.dark .reader-prose .hljs-comment");
    expect(source).toContain("color-mix(in oklab, var(--text-muted) 70%, white 30%)");
    expect(source).toContain("color-mix(in oklab, var(--accent-sky) 72%, white 28%)");
    expect(source).toContain("color-mix(in oklab, var(--accent-cyan) 72%, white 28%)");
  });
});
