"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { adminNavItems } from "./config";

export interface Tab {
  href: string;
  label: string;
}

interface AdminLayoutContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  tabs: Tab[];
  addTab: (tab: Tab) => void;
  closeTab: (href: string) => void;
  closeOtherTabs: (href: string) => void;
  closeAllTabs: () => void;
}

const AdminLayoutContext = createContext<AdminLayoutContextType | undefined>(undefined);
const HOME_TAB: Tab = { href: "/admin", label: "首页" };
const ADMIN_COLLAPSED_STORAGE_KEY = "vben_admin_collapsed";
const ADMIN_TABS_STORAGE_KEY = "vben_admin_tabs";
const MAX_ADMIN_TABS = 8;
const RESTORABLE_ADMIN_HREFS = new Set([
  ...adminNavItems.map((item) => item.href),
  "/admin/posts/new",
  "/admin/settings",
  "/admin/notifications",
]);

function readInitialCollapsedState() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_COLLAPSED_STORAGE_KEY) === "true";
}

function writeTabs(tabs: Tab[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TABS_STORAGE_KEY, JSON.stringify(tabs));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isRestorableAdminHref(href: string) {
  if (!href.startsWith("/admin")) return false;
  if (href.startsWith("//") || href.includes("://")) return false;
  if (href.includes("?") || href.includes("#")) return false;
  if (href.startsWith("/admin/api")) return false;

  return (
    RESTORABLE_ADMIN_HREFS.has(href) ||
    /^\/admin\/posts\/[^/]+\/edit$/.test(href) ||
    /^\/admin\/ai\/tasks\/[^/]+$/.test(href)
  );
}

function normalizeTabs(tabs: Tab[]) {
  const normalized: Tab[] = [HOME_TAB];
  const seen = new Set([HOME_TAB.href]);

  for (const tab of tabs) {
    if (seen.has(tab.href)) continue;
    normalized.push(tab);
    seen.add(tab.href);

    if (normalized.length >= MAX_ADMIN_TABS) break;
  }

  return normalized;
}

function appendTab(tabs: Tab[], tab: Tab) {
  if (tabs.some((item) => item.href === tab.href)) return tabs;
  const normalized = normalizeTabs(tabs);
  if (tab.href === HOME_TAB.href) return normalized;

  const retainedTabs = normalized.filter((item) => item.href !== HOME_TAB.href);
  return [HOME_TAB, ...[...retainedTabs, tab].slice(-(MAX_ADMIN_TABS - 1))];
}

function sanitizeStoredTab(value: unknown): Tab | null {
  if (!isRecord(value) || typeof value.href !== "string" || typeof value.label !== "string") {
    return null;
  }

  const href = value.href.trim();
  if (!isRestorableAdminHref(href)) return null;

  return getTabForPathname(href);
}

function readInitialTabs() {
  if (typeof window === "undefined") return [HOME_TAB];

  const savedTabs = localStorage.getItem(ADMIN_TABS_STORAGE_KEY);
  if (!savedTabs) return [HOME_TAB];

  try {
    const parsed: unknown = JSON.parse(savedTabs);
    if (!Array.isArray(parsed) || parsed.length === 0) return [HOME_TAB];

    return normalizeTabs(parsed.map(sanitizeStoredTab).filter((tab): tab is Tab => tab !== null));
  } catch {
    return [HOME_TAB];
  }
}

function getTabForPathname(pathname: string | null): Tab | null {
  if (!pathname) return null;
  if (!pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/admin/api")) return null;

  if (pathname === "/admin") {
    return HOME_TAB;
  }
  if (pathname === "/admin/posts/new") {
    return { href: pathname, label: "新建文章" };
  }
  if (pathname === "/admin/settings") {
    return { href: pathname, label: "设置" };
  }
  if (pathname === "/admin/notifications") {
    return { href: pathname, label: "通知中心" };
  }
  if (pathname.match(/^\/admin\/posts\/[^/]+\/edit$/)) {
    return { href: pathname, label: "编辑文章" };
  }
  if (pathname.match(/^\/admin\/ai\/tasks\/[^/]+$/)) {
    return { href: pathname, label: "AI 任务详情" };
  }

  const item = adminNavItems.find(
    (nav) => nav.href === pathname || (nav.href !== "/admin" && pathname.startsWith(nav.href))
  );
  return { href: pathname, label: item ? item.label : "管理后台" };
}

function ensureCurrentTab(tabs: Tab[], pathname: string | null) {
  const tab = getTabForPathname(pathname);
  if (!tab || tabs.some((item) => item.href === tab.href)) return tabs;
  return appendTab(tabs, tab);
}

export function AdminLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([HOME_TAB]);
  const hasRestoredStateRef = useRef(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSetCollapsed = (val: boolean) => {
    setIsCollapsedState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem(ADMIN_COLLAPSED_STORAGE_KEY, String(val));
    }
  };

  useEffect(() => {
    if (hasRestoredStateRef.current) return;

    const timeoutId = window.setTimeout(() => {
      const restoredTabs = ensureCurrentTab(readInitialTabs(), pathname);

      hasRestoredStateRef.current = true;
      setIsCollapsedState(readInitialCollapsedState());
      setTabs(restoredTabs);
      writeTabs(restoredTabs);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  useEffect(() => {
    if (!hasRestoredStateRef.current) return;

    const tab = getTabForPathname(pathname);
    if (!tab) return;

    const timeoutId = window.setTimeout(() => {
      setTabs((prev) => {
        const updated = appendTab(prev, tab);
        if (updated === prev) return prev;
        writeTabs(updated);
        return updated;
      });
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  const addTab = (tab: Tab) => {
    setTabs((prev) => {
      const safeTab = sanitizeStoredTab(tab);
      if (!safeTab) return prev;
      const updated = appendTab(prev, safeTab);
      if (updated === prev) return prev;
      writeTabs(updated);
      return updated;
    });
  };

  const closeTab = (hrefToClose: string) => {
    if (hrefToClose === "/admin") return; // Home cannot be closed

    setTabs((prev) => {
      const index = prev.findIndex((t) => t.href === hrefToClose);
      if (index === -1) return prev;

      const updated = prev.filter((t) => t.href !== hrefToClose);
      writeTabs(updated);

      // If closing the active tab, navigate to another open tab
      if (pathname === hrefToClose) {
        const nextActiveTab = prev[index - 1] || prev[index + 1] || { href: "/admin" };
        router.push(nextActiveTab.href);
      }

      return updated;
    });
  };

  const closeOtherTabs = (hrefToKeep: string) => {
    setTabs((prev) => {
      const homeTab = prev.find((t) => t.href === "/admin") || HOME_TAB;
      const keepTab = prev.find((t) => t.href === hrefToKeep);

      const updated = hrefToKeep === "/admin"
        ? [homeTab]
        : keepTab ? [homeTab, keepTab] : prev;

      writeTabs(updated);

      if (pathname !== hrefToKeep && pathname !== "/admin") {
        router.push(hrefToKeep);
      }

      return updated;
    });
  };

  const closeAllTabs = () => {
    setTabs([HOME_TAB]);
    writeTabs([HOME_TAB]);
    router.push("/admin");
  };

  return (
    <AdminLayoutContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed: handleSetCollapsed,
        tabs,
        addTab,
        closeTab,
        closeOtherTabs,
        closeAllTabs,
      }}
    >
      {children}
    </AdminLayoutContext.Provider>
  );
}

export function useAdminLayout() {
  const context = useContext(AdminLayoutContext);
  if (!context) {
    throw new Error("useAdminLayout must be used within an AdminLayoutProvider");
  }
  return context;
}
