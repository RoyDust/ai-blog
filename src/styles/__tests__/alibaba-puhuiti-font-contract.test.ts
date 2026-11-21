import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const fontDir = join(process.cwd(), "src/styles/fonts/alibaba-puhuiti");

function readFontFaces() {
  const source = readFileSync(join(fontDir, "500.css"), "utf8");
  return source.match(/@font-face \{[^}]+\}/g) ?? [];
}

describe("Alibaba PuHuiTi sliced font", () => {
  test("every @font-face is a swap woff2 slice with a unicode-range and an existing file", () => {
    const faces = readFontFaces();

    expect(faces.length).toBeGreaterThan(90);
    for (const face of faces) {
      expect(face).toContain("font-family: 'Alibaba PuHuiTi';");
      expect(face).toContain("font-display: swap;");
      expect(face).toMatch(/unicode-range: U\+/);

      const file = face.match(/url\(\.\/(files\/[^)]+\.woff2)\)/)?.[1];
      expect(file, face).toBeDefined();
      expect(existsSync(join(fontDir, file!)), file).toBe(true);
    }
  });

  test("root layout loads the slices instead of the whole font file", () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");

    expect(layout).toContain('import "@/styles/fonts/alibaba-puhuiti/500.css";');
    expect(layout).not.toContain('from "./fonts"');
  });
});
