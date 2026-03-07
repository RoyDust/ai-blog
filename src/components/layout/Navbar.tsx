"use client";

import Link from "next/link";
import { useState } from "react";
import { Home, Menu, Palette, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SearchForm } from "@/components/search/SearchForm";
import { HuePicker } from "@/components/ui/HuePicker";
import { useScrollHide } from "@/hooks/useScrollHide";

const navLinks = [
  { name: "首页", href: "/" },
  { name: "博客", href: "/posts" },
  { name: "归档", href: "/archives" },
];

export function Navbar() {
  const [showHuePicker, setShowHuePicker] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const isHidden = useScrollHide({ threshold: 100, delta: 5 });

  return (
    <div
      id="navbar"
      className={`onload-animation sticky top-0 z-50 transition-transform duration-300 ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="absolute -top-8 right-0 left-0 h-8 bg-[var(--card-bg)] transition" />

      <div className="card-base mx-auto flex h-[4.5rem] max-w-[var(--page-width)] items-center justify-between gap-3 !overflow-visible !rounded-t-none px-4 backdrop-blur-lg !bg-[var(--card-bg)]/80">
        <Link href="/" className="btn-plain h-[3.25rem] rounded-lg px-5 font-bold transition-colors">
          <div className="text-md flex items-center text-[var(--primary)]">
            <Home className="mr-2 -mb-1 h-7 w-7" />
            My Blog
          </div>
        </Link>

        <nav className="hidden md:flex" aria-label="Primary">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="btn-plain h-11 rounded-lg px-5 font-bold transition-colors">
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="hidden min-w-0 flex-1 lg:flex lg:max-w-sm">
          <SearchForm buttonLabel="搜索" compact placeholder="搜索文章" />
        </div>

        <div className="flex items-center">
          <Link
            href="/search"
            aria-label="搜索"
            title="搜索"
            className="btn-plain flex h-11 w-11 items-center justify-center rounded-lg transition-colors lg:hidden"
          >
            <Search className="h-5 w-5" />
          </Link>

          <button
            aria-label="主题色设置"
            className="btn-plain h-11 w-11 rounded-lg transition-colors"
            onClick={() => setShowHuePicker(!showHuePicker)}
            type="button"
          >
            <Palette className="h-5 w-5" />
          </button>

          <ThemeToggle />

          <button
            aria-label="菜单"
            className="btn-plain h-11 w-11 rounded-lg transition-colors md:hidden"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <div
          className={`card-base float-panel absolute top-[5.25rem] right-4 left-4 origin-top p-2 transition-all duration-200 md:hidden ${
            showMobileMenu ? "scale-y-100 opacity-100" : "pointer-events-none scale-y-95 opacity-0"
          }`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="btn-plain flex h-11 w-full items-center justify-start rounded-lg px-4 font-bold transition-colors"
              onClick={() => setShowMobileMenu(false)}
            >
              {link.name}
            </Link>
          ))}
        </div>

        <HuePicker isOpen={showHuePicker} />
      </div>
    </div>
  );
}
