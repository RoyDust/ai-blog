"use client";

import Link from "next/link";
import { useState } from "react";
import { HuePicker } from "@/components/ui/HuePicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useScrollHide } from "@/hooks/useScrollHide";

const navLinks = [
  { name: "首页", href: "/" },
  { name: "文章", href: "/posts" },
  { name: "分类", href: "/categories" },
  { name: "标签", href: "/tags" },
];

export function Navbar() {
  const [showHuePicker, setShowHuePicker] = useState(false);
  const isHidden = useScrollHide({ threshold: 100, delta: 5 });

  return (
    <div
      id="navbar"
      className={`onload-animation sticky top-0 z-50 transition-transform duration-300 ${
        isHidden ? "-translate-y-full" : "translate-y-0"
      }`}
    >
      <div className="absolute -top-8 right-0 left-0 h-8 bg-[var(--card-bg)] transition" />

      <div className="card-base mx-auto flex h-[4.5rem] max-w-[var(--page-width)] items-center justify-between !overflow-visible !rounded-t-none px-4 backdrop-blur-lg !bg-[var(--card-bg)]/80">
        <Link href="/" className="btn-plain h-[3.25rem] rounded-lg px-5 font-bold text-[var(--primary)]">
          My Blog
        </Link>

        <nav className="hidden md:flex">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="btn-plain h-11 rounded-lg px-5 font-bold">
              {link.name}
            </Link>
          ))}
        </nav>

        <div className="flex items-center">
          <button aria-label="搜索" className="btn-plain h-11 w-11 rounded-lg" type="button">
            S
          </button>
          <button
            aria-label="主题色设置"
            className="btn-plain h-11 w-11 rounded-lg"
            type="button"
            onClick={() => setShowHuePicker((current) => !current)}
          >
            C
          </button>
          <ThemeToggle />
        </div>

        <HuePicker isOpen={showHuePicker} />
      </div>
    </div>
  );
}
