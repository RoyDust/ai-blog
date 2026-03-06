import { FileText, FolderTree, LayoutDashboard, MessageSquare, Tags } from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  group: string;
  icon: typeof LayoutDashboard;
};

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "仪表盘", group: "总览", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章管理", group: "内容", icon: FileText },
  { href: "/admin/comments", label: "评论管理", group: "互动", icon: MessageSquare },
  { href: "/admin/categories", label: "分类管理", group: "配置", icon: FolderTree },
  { href: "/admin/tags", label: "标签管理", group: "配置", icon: Tags },
];

function resolveMatch(pathname: string) {
  if (pathname === "/admin/posts/new") {
    return {
      currentLabel: "新建文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "新建文章"],
    };
  }

  if (pathname.startsWith("/admin/posts/") && pathname.includes("/edit")) {
    return {
      currentLabel: "编辑文章",
      currentGroup: "内容",
      crumbs: ["后台", "内容", "编辑文章"],
    };
  }

  const activeItem =
    adminNavItems.find((item) => pathname === item.href) ??
    adminNavItems.find((item) => item.href !== "/admin" && pathname.startsWith(item.href));

  if (!activeItem) {
    return {
      currentLabel: "管理后台",
      currentGroup: "总览",
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

