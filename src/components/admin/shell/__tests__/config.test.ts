import { describe, expect, test } from "vitest";
import { adminNavItems, getAdminPathMeta, isAdminNavItemActive } from "../config";

describe("admin shell config", () => {
  test("maps create-post route into content breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/posts/new")).toEqual({
      currentLabel: "新建文章",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "新建文章"],
    });
  });

  test("maps taxonomy route into grouped workspace labels", () => {
    expect(getAdminPathMeta("/admin/taxonomy")).toEqual({
      currentLabel: "分类",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "分类"],
    });
  });

  test("maps AI model management route into grouped workspace labels", () => {
    expect(getAdminPathMeta("/admin/ai/models")).toEqual({
      currentLabel: "AI 模型",
      currentGroup: "AI 辅助",
      crumbs: ["后台", "AI 辅助", "AI 模型"],
    });
  });

  test("maps cover gallery route into content workspace labels", () => {
    expect(getAdminPathMeta("/admin/covers")).toEqual({
      currentLabel: "媒体库",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "媒体库"],
    });
  });

  test("maps AI task route into grouped workspace labels", () => {
    expect(getAdminPathMeta("/admin/ai/tasks")).toEqual({
      currentLabel: "AI 任务",
      currentGroup: "AI 辅助",
      crumbs: ["后台", "AI 辅助", "AI 任务"],
    });
  });

  test("maps AI news route into content breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/ai-news")).toEqual({
      currentLabel: "AI 日报",
      currentGroup: "AI 辅助",
      crumbs: ["后台", "AI 辅助", "AI 日报"],
    });
  });

  test("exposes the grouped editorial navigation items", () => {
    expect(adminNavItems.map((item) => ({ label: item.label, group: item.group, disabled: item.disabled ?? false }))).toEqual([
      { label: "首页", group: "主导航", disabled: false },
      { label: "文章", group: "主导航", disabled: false },
      { label: "草稿", group: "主导航", disabled: false },
      { label: "评论", group: "主导航", disabled: false },
      { label: "分类", group: "主导航", disabled: false },
      { label: "媒体库", group: "主导航", disabled: false },
      { label: "设置", group: "主导航", disabled: true },
      { label: "AI 日报", group: "AI 辅助", disabled: false },
      { label: "AI 模型", group: "AI 辅助", disabled: false },
      { label: "AI 任务", group: "AI 辅助", disabled: false },
    ]);
  });

  test("matches only complete admin nav path segments", () => {
    expect(isAdminNavItemActive("/admin/posts", "/admin/posts")).toBe(true);
    expect(isAdminNavItemActive("/admin/posts", "/admin/posts?status=draft")).toBe(true);
    expect(isAdminNavItemActive("/admin/posts/123/edit", "/admin/posts")).toBe(true);
    expect(isAdminNavItemActive("/admin/posts-archive", "/admin/posts")).toBe(false);
    expect(isAdminNavItemActive("/admin/covers", "/admin/covers")).toBe(true);
    expect(isAdminNavItemActive("/admin/taxonomy", "/admin/taxonomy")).toBe(true);
    expect(isAdminNavItemActive("/admin/ai/models", "/admin/ai/models")).toBe(true);
    expect(isAdminNavItemActive("/admin/ai/tasks/task-1", "/admin/ai/tasks")).toBe(true);
  });

  test("maps only true post edit routes into edit breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/posts/post-1/edit")).toEqual({
      currentLabel: "编辑文章",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "编辑文章"],
    });

    expect(getAdminPathMeta("/admin/posts/edit")).toEqual({
      currentLabel: "文章",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "文章"],
    });
  });
});
