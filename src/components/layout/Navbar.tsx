"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { Menu, Search } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { AccountEntry } from "@/components/auth/AccountEntry";
import { ActiveUnderline, editorialEase } from "@/components/editorial";
import { SearchForm } from "@/components/search/SearchForm";
import { useScrollHide } from "@/hooks/useScrollHide";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";

const navLinks = [
  { name: "首页", href: "/" },
  { name: "文章", href: "/posts" },
  { name: "系列", href: "/series" },
  { name: "归档", href: "/archives" },
  { name: "关于", href: "/about" },
];

function isActivePath(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

interface NavbarProps {
  siteName?: string;
}

/**
 * 方向 A 导航条（简报 15.3）：6px 圆角实底条，导航项只有文字，当前项 2px sky 下划线在项间平移。
 * 向下滚动隐藏、向上滚动出现；md 以下收进就地展开的菜单面板（无遮罩），明暗切换在 sm 以下收进菜单。
 */
// Keep this fallback aligned with DEFAULT_BLOG_SETTINGS without importing server-only settings code.
export function Navbar({ siteName = "My Blog" }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  const isHidden = useScrollHide({ threshold: 100, delta: 720 });
  const navbarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const reduce = useReducedMotion();

  // 路由变化时收起菜单（渲染期调整，避免 effect 内同步 setState）
  if (menuOpen && menuPath !== pathname) {
    setMenuOpen(false);
  }

  useEffect(() => {
    const root = document.documentElement;

    const syncSidebarOffset = () => {
      const height = navbarRef.current?.getBoundingClientRect().height ?? 0;
      root.style.setProperty("--sidebar-sticky-top", isHidden ? "0px" : `${height}px`);
    };

    syncSidebarOffset();
    window.addEventListener("resize", syncSidebarOffset);

    return () => {
      window.removeEventListener("resize", syncSidebarOffset);
      root.style.removeProperty("--sidebar-sticky-top");
    };
  }, [isHidden]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [menuOpen]);

  const toggleMenu = () => {
    setMenuPath(pathname);
    setMenuOpen((open) => !open);
  };

  const themeLabel = theme === "dark" ? "切换到日间主题" : "切换到夜间主题";

  return (
    <div
      ref={navbarRef}
      id="navbar"
      data-hidden={isHidden ? "true" : "false"}
      className={cn(
        "sticky top-0 z-50 px-3 pb-2 pt-[var(--reader-nav-offset)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:px-4",
        isHidden && !menuOpen ? "-translate-y-full" : "translate-y-0",
      )}
    >
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: editorialEase }}
        className="reader-nav relative mx-auto flex h-[var(--reader-nav-height)] w-full max-w-[var(--reader-nav-width)] items-center justify-between gap-2 px-2 sm:gap-3 sm:px-3 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <div className="min-w-0 justify-self-start">
          <Link
            href="/"
            className="inline-flex h-11 min-w-0 max-w-full shrink-0 items-center gap-2.5 rounded-[var(--radius-ctl)] px-1.5 text-[var(--foreground)]"
          >
            <BrandMark siteName={siteName} size={28} />
            <span className="min-w-0 truncate text-[0.92rem] font-bold">{siteName}</span>
          </Link>
        </div>

        <nav className="hidden min-w-0 items-center justify-center justify-self-center md:flex" aria-label="Primary">
          <LayoutGroup id="reader-nav">
            <ul className="flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = isActivePath(pathname, link.href);
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={isActive ? "page" : undefined}
                      className="ed-tab reader-nav-link h-11 px-3 text-[0.8125rem]"
                    >
                      {link.name}
                      {isActive ? (
                        <ActiveUnderline layoutId="reader-nav-active-indicator" className="ed-underline left-3 right-3 -bottom-[3px]" />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </LayoutGroup>
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-0.5 md:w-full md:justify-self-end">
          <div className="reader-nav-search hidden min-w-0 flex-1 lg:flex lg:max-w-[10.5rem] lg:justify-end xl:max-w-[12rem]">
            <SearchForm appearance="navbar" compact placeholder="搜索" />
          </div>

          <Link href="/search" aria-label="搜索" title="搜索" className="ed-icon-btn lg:hidden">
            <Search aria-hidden="true" className="h-[1.125rem] w-[1.125rem]" />
          </Link>

          <span className="hidden sm:flex">
            <ThemeToggle />
          </span>

          <AccountEntry />

          <button
            aria-label="菜单"
            aria-expanded={menuOpen}
            aria-controls="mobile-reader-menu"
            className="ed-icon-btn md:hidden"
            onClick={toggleMenu}
            type="button"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {menuOpen ? (
            <motion.div
              key="mobile-menu"
              id="mobile-reader-menu"
              data-state="open"
              className="ed-popover absolute left-2 right-2 top-[calc(var(--reader-nav-height)+0.5rem)] origin-top overflow-hidden md:hidden"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, clipPath: "inset(0 0 100% 0)" }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, clipPath: "inset(0 0 100% 0)" }}
              transition={{ duration: 0.32, ease: editorialEase }}
            >
              <nav aria-label="移动端导航" className="p-1.5">
                <ul className="grid">
                  {navLinks.map((link, index) => {
                    const isActive = isActivePath(pathname, link.href);
                    return (
                      <motion.li
                        key={link.href}
                        initial={reduce ? false : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, ease: editorialEase, delay: 0.04 + index * 0.035 }}
                      >
                        <Link
                          href={link.href}
                          aria-current={isActive ? "page" : undefined}
                          className="flex min-h-11 items-center rounded-[var(--radius-ctl)] px-3 text-[0.9375rem] font-bold text-[var(--text-muted)] transition-colors hover:bg-[var(--ed-press-bg)] hover:text-[var(--foreground)] aria-[current=page]:text-[var(--foreground)]"
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className="relative py-1">
                            {link.name}
                            {isActive ? <span aria-hidden="true" className="ed-underline -bottom-0.5" /> : null}
                          </span>
                        </Link>
                      </motion.li>
                    );
                  })}
                </ul>
                <div className="mt-1 border-t border-[var(--border)] pt-1 sm:hidden">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center rounded-[var(--radius-ctl)] px-3 text-left text-[0.9375rem] font-bold text-[var(--text-body)] transition-colors hover:bg-[var(--ed-press-bg)] hover:text-[var(--foreground)]"
                    onClick={() => {
                      toggleTheme();
                      setMenuOpen(false);
                    }}
                  >
                    {themeLabel}
                  </button>
                </div>
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
