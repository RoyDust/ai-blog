"use client";

import { ArrowUp } from "lucide-react";

export function BackToTopButton() {
  return (
    <button
      aria-label="返回顶部"
      className="reader-icon-btn fixed bottom-6 right-6 z-40 bg-[color-mix(in_oklab,var(--reader-panel)_88%,transparent)] text-[var(--foreground)] shadow-[var(--reader-shadow)] backdrop-blur"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      type="button"
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
