import { describe, expect, test } from "vitest";
import { adminNavItems, getAdminPathMeta, isAdminNavItemActive } from "../config";

describe("admin shell config", () => {
  test("maps create-post route into content breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/posts/new")).toEqual({
      currentLabel: "新建文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "新建文章"],
    });
  });

  test("maps taxonomy route into grouped workspace labels", () => {
    expect(getAdminPathMeta("/admin/taxonomy")).toEqual({
      currentLabel: "分类与标签",
      currentGroup: "结构",
      crumbs: ["后台", "结构", "分类与标签"],
    });
  });

  test("maps AI news route into content breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/ai-news")).toEqual({
      currentLabel: "AI 日报",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "AI 日报"],
    });
  });

  test("exposes the grouped editorial navigation items", () => {
    expect(adminNavItems.map((item) => ({ label: item.label, group: item.group }))).toEqual([
      { label: "总览", group: "工作台" },
      { label: "文章", group: "内容" },
      { label: "AI 日报", group: "内容" },
      { label: "评论", group: "互动" },
      { label: "分类与标签", group: "结构" },
    ]);
  });

  test("matches only complete admin nav path segments", () => {
    expect(isAdminNavItemActive("/admin/posts", "/admin/posts")).toBe(true);
    expect(isAdminNavItemActive("/admin/posts/123/edit", "/admin/posts")).toBe(true);
    expect(isAdminNavItemActive("/admin/posts-archive", "/admin/posts")).toBe(false);
    expect(isAdminNavItemActive("/admin/taxonomy", "/admin/taxonomy")).toBe(true);
  });

  test("maps only true post edit routes into edit breadcrumbs", () => {
    expect(getAdminPathMeta("/admin/posts/post-1/edit")).toEqual({
      currentLabel: "编辑文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "编辑文章"],
    });

    expect(getAdminPathMeta("/admin/posts/edit")).toEqual({
      currentLabel: "文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "文章"],
    });
  });
});
