"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Archive, BookOpenText, Home, Menu, Palette, Search, Sparkles, UserRound } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchForm } from "@/components/search/SearchForm";
import { HuePicker } from "@/components/ui/HuePicker";
import { useScrollHide } from "@/hooks/useScrollHide";
import { cn } from "@/lib/cn";

const navLinks = [
  { name: "首页", href: "/", icon: Home },
  { name: "文章", href: "/posts", icon: BookOpenText },
  { name: "归档", href: "/archives", icon: Archive },
  { name: "关于", href: "/about", icon: UserRound },
];

const navItemClass =
  "reader-link inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-[var(--text-body)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-sky)_12%,transparent)] hover:text-[var(--foreground)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-sky)_14%,transparent)]";

export function Navbar() {
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
      <div className="reader-nav relative mx-auto flex h-[var(--reader-nav-height)] max-w-[var(--page-width)] items-center justify-between gap-2 px-2.5 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="reader-link inline-flex h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-bold text-[var(--foreground)] transition-colors hover:bg-[color:color-mix(in_oklab,var(--accent-warm)_12%,transparent)] focus-visible:bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] sm:px-4"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_30%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_16%,transparent)] text-[var(--accent-warm)]">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="min-w-0 truncate text-base tracking-normal">
            My Blog
          </span>
        </Link>

        <nav className="hidden min-w-0 items-center justify-center md:flex" aria-label="Primary">
          <div className="flex items-center gap-1 rounded-full bg-[color:color-mix(in_oklab,var(--reader-panel-muted)_54%,transparent)] p-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    navItemClass,
                    isActive && "bg-[color:color-mix(in_oklab,var(--accent-sky)_18%,transparent)] text-[color:color-mix(in_oklab,var(--accent-sky)_72%,var(--foreground)_28%)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{link.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1 sm:gap-2">
          <div className="hidden min-w-0 flex-1 lg:flex lg:max-w-sm lg:justify-end">
            <SearchForm appearance="navbar" compact placeholder="搜索文章、标签或分类" />
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

        <div
          id="mobile-reader-menu"
          aria-hidden={!showMobileMenu}
          data-state={showMobileMenu ? "open" : "closed"}
          className={`reader-panel absolute top-[calc(var(--reader-nav-height)+0.75rem)] right-2 left-2 origin-top p-2 transition-all duration-200 md:hidden ${showMobileMenu ? "scale-y-100 opacity-100" : "pointer-events-none scale-y-95 opacity-0"}`}
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
        </div>

        <HuePicker isOpen={showHuePicker} />
      </div>
    </div>
  );
}
