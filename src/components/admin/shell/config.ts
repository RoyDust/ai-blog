import type { LucideIcon } from "lucide-react";
import {
  BrainCircuit,
  FileText,
  FolderTree,
  Images,
  LayoutDashboard,
  ListChecks,
  ListTree,
  Mail,
  Map,
  MessageSquare,
  Newspaper,
  Radar,
  Route,
  ScrollText,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  group: string;
  icon: LucideIcon;
  disabled?: boolean;
  badge?: string;
};

export const ADMIN_AI_GROUP_LABEL = "AI 助手";

function hasPathSegment(pathname: string, href: string) {
  const normalizedPathname = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
}

export const adminNavItems: AdminNavItem[] = [
  { href: "/admin", label: "首页", group: "主导航", icon: LayoutDashboard },
  { href: "/admin/posts", label: "文章", group: "主导航", icon: FileText },
  { href: "/admin/series", label: "系列", group: "主导航", icon: ListTree },
  { href: "/admin/comments", label: "评论", group: "主导航", icon: MessageSquare },
  { href: "/admin/taxonomy", label: "分类", group: "主导航", icon: FolderTree },
  { href: "/admin/covers", label: "媒体库", group: "主导航", icon: Images },
  { href: "/admin/newsletter", label: "邮件运营", group: "主导航", icon: Mail },
  { href: "/admin/topic-guides", label: "专题导读", group: "主导航", icon: Map },
  { href: "/admin/ai-news", label: "AI 日报", group: ADMIN_AI_GROUP_LABEL, icon: Newspaper },
  { href: "/admin/ai/topics", label: "选题雷达", group: ADMIN_AI_GROUP_LABEL, icon: Radar },
  { href: "/admin/ai/interfaces", label: "AI 接口", group: ADMIN_AI_GROUP_LABEL, icon: Route },
  { href: "/admin/ai/models", label: "模型配置", group: ADMIN_AI_GROUP_LABEL, icon: BrainCircuit },
  { href: "/admin/ai/tasks", label: "AI 任务", group: ADMIN_AI_GROUP_LABEL, icon: ListChecks },
  { href: "/admin/logs", label: "接口日志", group: "系统", icon: ScrollText },
];

export function isAdminNavItemActive(pathname: string, href: string) {
  const hrefPathname = href.split("?")[0] ?? href;

  if (href === "/admin") {
    return pathname === href;
  }

  return hasPathSegment(pathname, hrefPathname);
}

function resolveMatch(pathname: string) {
  if (pathname === "/admin/posts/new") {
    return {
      currentLabel: "新建文章",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "新建文章"],
    };
  }

  const postEditMatch = pathname.match(/^\/admin\/posts\/[^/]+\/edit$/);
  if (postEditMatch) {
    return {
      currentLabel: "编辑文章",
      currentGroup: "主导航",
      crumbs: ["后台", "主导航", "编辑文章"],
    };
  }

  if (pathname === "/admin/settings") {
    return {
      currentLabel: "设置",
      currentGroup: "账号",
      crumbs: ["后台", "账号", "设置"],
    };
  }

  if (pathname === "/admin/notifications") {
    return {
      currentLabel: "通知中心",
      currentGroup: "后台",
      crumbs: ["后台", "通知中心"],
    };
  }

  const activeItem =
    adminNavItems.find((item) => pathname === item.href) ??
    adminNavItems.find((item) => item.href !== "/admin" && isAdminNavItemActive(pathname, item.href));

  if (!activeItem) {
    return {
      currentLabel: "管理后台",
      currentGroup: "主导航",
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
