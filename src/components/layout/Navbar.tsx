"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Archive, BookOpenText, Home, ListTree, Menu, Palette, Search, Sparkles, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { AccountEntry } from "@/components/auth/AccountEntry";
import { SearchForm } from "@/components/search/SearchForm";
import { HuePicker } from "@/components/ui/HuePicker";
import { useScrollHide } from "@/hooks/useScrollHide";
import { cn } from "@/lib/cn";
import { LayoutGroup, motion } from "motion/react";
import { panelTransition } from "@/components/motion/transitions";

const navLinks = [
  { name: "首页", href: "/", icon: Home },
  { name: "文章", href: "/posts", icon: BookOpenText },
  { name: "系列", href: "/series", icon: ListTree },
  { name: "归档", href: "/archives", icon: Archive },
  { name: "关于", href: "/about", icon: UserRound },
];

const navItemClass =
  "reader-link relative inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[0.8rem] font-bold text-[var(--text-body)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-sky)_10%,transparent)] hover:text-[var(--foreground)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-sky)_14%,transparent)]";

interface NavbarProps {
  siteName?: string;
}

// Keep this fallback aligned with DEFAULT_BLOG_SETTINGS without importing server-only settings code.
export function Navbar({ siteName = "My Blog" }: NavbarProps) {
  const [showHuePicker, setShowHuePicker] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const isHidden = useScrollHide({ threshold: 100, delta: 5 });
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
      className={`onload-animation sticky top-0 z-50 px-3 pt-[var(--reader-nav-offset)] pb-2 transition-transform duration-300 sm:px-4 ${isHidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="reader-nav relative mx-auto flex h-[var(--reader-nav-height)] w-full max-w-[var(--reader-nav-width)] items-center justify-between gap-2 px-3 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="reader-link inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-2 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-sky)_10%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-sky)_14%,transparent)]"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-[color:color-mix(in_oklab,var(--accent-sky)_34%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-sky)_16%,transparent)] text-[var(--accent-sky)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate text-[0.92rem] tracking-normal">{siteName}</span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-center md:flex" aria-label="Primary">
          <LayoutGroup id="reader-nav">
            <div className="flex items-center gap-1">
              {navLinks.map((link) => {
                const Icon = link.icon;
                const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      navItemClass,
                      isActive &&
                        "bg-[color:color-mix(in_oklab,var(--accent-sky)_10%,transparent)] text-[color:color-mix(in_oklab,var(--accent-sky)_72%,var(--foreground)_28%)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{link.name}</span>
                    {isActive && (
                      <motion.span
                        layoutId="reader-nav-active-indicator"
                        className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--accent-sky)]"
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          </LayoutGroup>
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <div className="hidden min-w-0 flex-1 lg:flex lg:max-w-sm lg:justify-end">
            <SearchForm appearance="navbar" compact placeholder="搜索" />
          </div>

          <Link
            href="/search"
            aria-label="搜索"
            title="搜索"
            className="reader-icon-btn lg:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            aria-label="主题设置"
            aria-expanded={showHuePicker}
            className="reader-icon-btn"
            onClick={() => setShowHuePicker(!showHuePicker)}
            type="button"
          >
            <Palette className="h-5 w-5" />
          </button>

          <ThemeToggle />

          <AccountEntry />

          <button
            aria-label="菜单"
            aria-expanded={showMobileMenu}
            aria-controls="mobile-reader-menu"
            className="reader-icon-btn md:hidden"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <motion.div
          id="mobile-reader-menu"
          aria-hidden={!showMobileMenu}
          data-state={showMobileMenu ? "open" : "closed"}
          className="reader-panel absolute top-[calc(var(--reader-nav-height)+0.75rem)] right-2 left-2 origin-top p-2 md:hidden"
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
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="reader-link flex h-11 w-full items-center justify-start gap-3 rounded-xl px-4 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-sky)_12%,transparent)] hover:text-[var(--foreground)]"
                  onClick={() => setShowMobileMenu(false)}
                  tabIndex={showMobileMenu ? undefined : -1}
                >
                  <Icon className="h-4 w-4" />
                  {link.name}
                </Link>
              );
            })}
          </div>
        </motion.div>

        <HuePicker isOpen={showHuePicker} />
      </div>
    </div>
  );
}
