import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("admin settings client panel boundary", () => {
  test("settings panels live in dedicated components, not inline in the client entry", () => {
    const clientSource = readSource("src/components/admin/settings/AdminSettingsClient.tsx");

    // 入口只做表单实例、保存动作与 tab 装配
    expect(clientSource).not.toContain("WorkspacePanel");
    expect(clientSource).not.toContain("<FormField");
    expect(clientSource).not.toContain("<Input");
  });
});

describe("admin ai-news page panel boundary", () => {
  test("ai-news panels live in dedicated components, not inline in the page", () => {
    const pageSource = readSource("src/app/admin/ai-news/page.tsx");

    // 页面只做头部动作、确认弹窗与面板装配
    expect(pageSource).not.toContain("WorkspacePanel");
    expect(pageSource).not.toContain("<StatusBadge");
    expect(pageSource).not.toContain("<Link");
  });
});
