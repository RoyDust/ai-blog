import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("admin post workspace layout contract", () => {
  test("right sidebar panels stack by content height instead of forcing every card full-height", () => {
    const workspaceSource = readSource("src/components/posts/AdminPostWorkspace.tsx");
    const publishSettingsSource = readSource("src/components/posts/PublishSettingsPanel.tsx");
    const panelSource = readSource("src/components/admin/primitives/WorkspacePanel.tsx");

    expect(panelSource).toContain("fillHeight?: boolean");
    expect(panelSource).toContain("fillHeight = true");
    expect(panelSource).toContain('${fillHeight ? "h-full" : ""}');
    expect(panelSource).not.toContain("MotionReveal");
    // WorkspacePanel 外壳保留在工作台布局里（非全高卡片），面板内容抽到独立展示组件
    expect(workspaceSource).toContain('title="分类、标签与封面图"');
    expect(workspaceSource).toContain("fillHeight={false}");
    expect(workspaceSource).not.toContain('WorkspacePanel title="精选状态"');
    expect(workspaceSource).not.toContain('WorkspacePanel title="AI 辅助"');
    // 发布设置面板内容必须位于 PublishSettingsPanel，不允许回流回主组件
    expect(publishSettingsSource).toContain('<p className="text-sm font-medium text-[var(--foreground)]">精选状态</p>');
    expect(workspaceSource).not.toContain('<p className="text-sm font-medium text-[var(--foreground)]">精选状态</p>');
  });

  test("status action buttons collapse to one column on narrow editor widths", () => {
    const workspaceSource = readSource("src/components/posts/AdminPostWorkspace.tsx");
    const publishSettingsSource = readSource("src/components/posts/PublishSettingsPanel.tsx");

    // 状态按钮的窄屏单列布局属于发布设置面板内容
    expect(publishSettingsSource).toContain("grid grid-cols-1 gap-2 sm:grid-cols-2");
    expect(workspaceSource).not.toContain("grid grid-cols-1 gap-2 sm:grid-cols-2");
    expect(workspaceSource).not.toContain("grid grid-cols-2 gap-2");
  });
});
