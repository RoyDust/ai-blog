import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("admin post workspace layout contract", () => {
  test("right sidebar panels stack by content height instead of forcing every card full-height", () => {
    const workspaceSource = readSource("src/components/posts/AdminPostWorkspace.tsx");
    const panelSource = readSource("src/components/admin/primitives/WorkspacePanel.tsx");

    expect(panelSource).toContain("fillHeight?: boolean");
    expect(panelSource).toContain("fillHeight = true");
    expect(panelSource).toContain('${fillHeight ? "h-full" : ""}');
    expect(panelSource).not.toContain("MotionReveal");
    expect(workspaceSource).toContain('title="分类、标签与封面图"');
    expect(workspaceSource).toContain('<p className="text-sm font-medium text-[var(--foreground)]">精选状态</p>');
    expect(workspaceSource).not.toContain('WorkspacePanel title="精选状态"');
    expect(workspaceSource).not.toContain('WorkspacePanel title="AI 辅助"');
    expect(workspaceSource).toContain("fillHeight={false}");
  });

  test("status action buttons collapse to one column on narrow editor widths", () => {
    const workspaceSource = readSource("src/components/posts/AdminPostWorkspace.tsx");

    expect(workspaceSource).toContain("grid grid-cols-1 gap-2 sm:grid-cols-2");
    expect(workspaceSource).not.toContain("grid grid-cols-2 gap-2");
  });
});
