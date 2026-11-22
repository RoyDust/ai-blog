"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Archive, BookOpenText, Compass, Home, ListTree, Menu, Moon, Palette, Search, Sun, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { AccountEntry } from "@/components/auth/AccountEntry";
import { PublicCommandSearch } from "@/components/search/PublicCommandSearch";
import { SearchForm } from "@/components/search/SearchForm";
import { HuePicker } from "@/components/ui/HuePicker";
import { useScrollHide } from "@/hooks/useScrollHide";
import { cn } from "@/lib/cn";
import { LayoutGroup, motion } from "motion/react";
import { headerResizeTransition, panelTransition } from "@/components/motion/transitions";

const navLinks = [
  { name: "首页", href: "/", icon: Home },
  { name: "文章", href: "/posts", icon: BookOpenText },
  { name: "系列", href: "/series", icon: ListTree },
  { name: "专题", href: "/guides", icon: Compass },
  { name: "归档", href: "/archives", icon: Archive },
  { name: "关于", href: "/about", icon: UserRound },
];

const navItemClass =
  "reader-link relative inline-flex h-8.5 items-center gap-1.5 rounded-[0.5625rem] px-3 text-[0.8125rem] font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--accent-sky)] focus-visible:bg-[var(--btn-regular-bg)]";

interface NavbarProps {
  siteName?: string;
}

// Keep this fallback aligned with DEFAULT_BLOG_SETTINGS without importing server-only settings code.
export function Navbar({ siteName = "My Blog" }: NavbarProps) {
  const [showHuePicker, setShowHuePicker] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const isHidden = useScrollHide({ threshold: 100, delta: 720 });
  const navbarRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

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

  return (
    <div
      ref={navbarRef}
      id="navbar"
      className={`onload-animation sticky top-0 z-50 px-3 pt-[var(--reader-nav-offset)] pb-1.5 transition-transform duration-300 sm:px-4 ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <motion.div
        layout
        transition={headerResizeTransition}
        className="reader-nav relative mx-auto flex h-[var(--reader-nav-height)] w-full max-w-[var(--page-width)] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-3.5 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
      >
        <motion.div layout="position" transition={headerResizeTransition} className="min-w-0 justify-self-start">
          <Link
            href="/"
            className="reader-link inline-flex h-9 min-w-0 max-w-full shrink-0 items-center gap-2 rounded-[0.5625rem] px-2 text-sm font-bold text-[var(--brand)] transition-colors hover:bg-[var(--btn-regular-bg)] focus-visible:bg-[var(--btn-regular-bg)]"
          >
            <span className="flex h-6.5 w-6.5 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--btn-regular-bg)] ring-1 ring-[var(--reader-border)]">
              <Image alt="" aria-hidden="true" className="h-full w-full object-cover" height={26} priority src="/icons/icon-192.png" width={26} />
            </span>
            <span className="min-w-0 truncate text-[0.90625rem] tracking-normal">{siteName}</span>
          </Link>
        </motion.div>

        <motion.nav
          layout="position"
          transition={headerResizeTransition}
          className="hidden min-w-0 items-center justify-center justify-self-center md:flex"
          aria-label="Primary"
        >
          <LayoutGroup id="reader-nav">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      navItemClass,
                      isActive && "bg-[var(--btn-regular-bg)] text-[var(--btn-content)] hover:text-[var(--btn-content)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{link.name}</span>
                  </Link>
                );
              })}
            </div>
          </LayoutGroup>
        </motion.nav>

        <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-1.5 md:w-full md:justify-self-end">
          <motion.div
            layout="size"
            transition={headerResizeTransition}
            className="reader-nav-search hidden min-w-0 flex-1 lg:flex lg:max-w-[15rem] lg:justify-end"
          >
            <SearchForm appearance="navbar" compact placeholder="搜索…" />
          </motion.div>

          <motion.div layout="position" transition={headerResizeTransition} className="flex shrink-0 items-center gap-1">
            <PublicCommandSearch />

            <Link
              href="/search"
              aria-label="搜索"
              title="搜索"
              className="reader-icon-btn h-8.5 w-8.5 lg:hidden"
            >
              <Search className="h-4 w-4" />
            </Link>

            <button
              aria-label="主题设置"
              aria-expanded={showHuePicker}
              className="reader-icon-btn hidden h-8.5 w-8.5 sm:inline-flex"
              onClick={() => setShowHuePicker(!showHuePicker)}
              type="button"
            >
              <Palette className="h-4 w-4" />
            </button>

            <span className="hidden sm:flex">
              <ThemeToggle />
            </span>

            <AccountEntry />

            <button
              aria-label="菜单"
              aria-expanded={showMobileMenu}
              aria-controls="mobile-reader-menu"
              className="reader-icon-btn h-8.5 w-8.5 md:hidden"
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              type="button"
            >
              <Menu className="h-4 w-4" />
            </button>
          </motion.div>
        </div>

        <motion.div
          id="mobile-reader-menu"
          aria-hidden={!showMobileMenu}
          data-state={showMobileMenu ? "open" : "closed"}
          className={`reader-panel absolute top-[calc(var(--reader-nav-height)+0.5rem)] right-2 left-2 origin-top p-2 md:hidden ${showMobileMenu ? "visible" : "invisible"}`}
          animate={{
            opacity: showMobileMenu ? 1 : 0,
            scale: showMobileMenu ? 1 : 0.97,
            y: showMobileMenu ? 0 : -6,
            pointerEvents: showMobileMenu ? "auto" : "none",
          }}
          initial={false}
          transition={panelTransition}
        >
          <div className="grid gap-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "reader-link flex h-10 w-full items-center justify-start gap-3 rounded-xl px-3.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)]",
                    isActive && "bg-[var(--btn-regular-bg)] text-[var(--btn-content)]",
                  )}
                  onClick={() => setShowMobileMenu(false)}
                  tabIndex={showMobileMenu ? undefined : -1}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {link.name}
                </Link>
              );
            })}

            <button
              type="button"
              className="reader-link mt-1 flex h-10 w-full items-center justify-start gap-3 rounded-xl border-t border-[var(--reader-border)] px-3.5 pt-1 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] sm:hidden"
              onClick={() => {
                toggleTheme();
                setShowMobileMenu(false);
              }}
              tabIndex={showMobileMenu ? undefined : -1}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === "dark" ? "切换到日间主题" : "切换到夜间主题"}
            </button>

            <button
              type="button"
              aria-expanded={showHuePicker}
              className="reader-link flex h-10 w-full items-center justify-start gap-3 rounded-xl px-3.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[var(--btn-regular-bg)] hover:text-[var(--btn-content)] sm:hidden"
              onClick={() => {
                setShowMobileMenu(false);
                setShowHuePicker(true);
              }}
              tabIndex={showMobileMenu ? undefined : -1}
            >
              <Palette className="h-4 w-4" />
              主题色
            </button>
          </div>
        </motion.div>

        <HuePicker isOpen={showHuePicker} />
      </motion.div>
    </div>
  );
}
