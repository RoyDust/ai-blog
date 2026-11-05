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
    expect(publishSettingsSource).toContain('label="精选状态"');
    expect(workspaceSource).not.toContain('label="精选状态"');
    // 方向 A：右栏分段是 pane 变体（衬线 1rem 标题 + 段间 1px 强线），不再是圆角卡
    expect(workspaceSource).toContain('variant="pane"');
    expect(workspaceSource).not.toContain('className="rounded-2xl"');
  });

  test("binary status toggles are radio groups inside the publish settings panel", () => {
    const workspaceSource = readSource("src/components/posts/AdminPostWorkspace.tsx");
    const publishSettingsSource = readSource("src/components/posts/PublishSettingsPanel.tsx");

    // 发布状态 / 精选状态从两个按钮改为单选组（方向 A 第 15 节），只属于发布设置面板内容
    expect(publishSettingsSource).toContain("<RadioChoiceGroup");
    expect(publishSettingsSource).not.toContain("切换为已发布");
    expect(workspaceSource).not.toContain("<RadioChoiceGroup");
    // 「允许评论」静态开关按已采纳假设去掉
    expect(publishSettingsSource).not.toContain("允许评论");
  });
});
