import type { LucideIcon } from "lucide-react";
import { BrainCircuit, FileText, FolderTree, LayoutDashboard, MessageSquare } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  group: string;
  icon: LucideIcon;
};

function hasPathSegment(pathname: string, href: string) {
  const normalizedPathname = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "总览", group: "工作台", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章", group: "内容", icon: FileText },
  { href: "/admin/comments", label: "评论", group: "互动", icon: MessageSquare },
  { href: "/admin/taxonomy", label: "分类与标签", group: "结构", icon: FolderTree },
  { href: "/admin/ai/models", label: "AI 模型", group: "智能", icon: BrainCircuit },
];

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === href;
  }

  return hasPathSegment(pathname, href);
}

function resolveMatch(pathname: string) {
  if (pathname === "/admin/posts/new") {
    return {
      currentLabel: "新建文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "新建文章"],
    };
  }

  const postEditMatch = pathname.match(/^\/admin\/posts\/[^/]+\/edit$/);
  if (postEditMatch) {
    return {
      currentLabel: "编辑文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "编辑文章"],
    };
  }

  const activeItem =
    adminNavItems.find((item) => pathname === item.href) ??
    adminNavItems.find((item) => item.href !== "/admin" && isAdminNavItemActive(pathname, item.href));

  if (!activeItem) {
    return {
      currentLabel: "管理后台",
      currentGroup: "工作台",
      crumbs: ["后台"],
    };
  }

  return {
    currentLabel: activeItem.label,
    currentGroup: activeItem.group,
    crumbs: ["后台", activeItem.group, activeItem.label],
  };
}

export function getAdminPathMeta(pathname: string) {
  return resolveMatch(pathname);
}
